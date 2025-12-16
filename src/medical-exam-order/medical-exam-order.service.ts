import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { ClientService } from '../client/client.service';
import { CommerceService } from '../commerce/commerce.service';
import { ConsultationHistoryService } from '../patient-history/consultation-history.service';

import { CreateExamOrderDto } from './dto/create-exam-order.dto';
import MedicalExamOrderCompleted from './events/MedicalExamOrderCompleted';
import MedicalExamOrderCreated from './events/MedicalExamOrderCreated';
import MedicalExamOrderUpdated from './events/MedicalExamOrderUpdated';
import { MedicalExamOrderPdfService } from './medical-exam-order-pdf.service';
import { ExamOrderStatus, ExamPriority, ExamType } from './model/exam-order-status.enum';
import { MedicalExamOrder, ExamResult } from './model/medical-exam-order.entity';
import { MedicalExam } from './model/medical-exam.entity';

@Injectable()
export class MedicalExamOrderService {
  constructor(
    @InjectRepository(MedicalExamOrder)
    private examOrderRepository = getRepository(MedicalExamOrder),
    @InjectRepository(MedicalExam)
    private examRepository = getRepository(MedicalExam),
    private examOrderPdfService: MedicalExamOrderPdfService,
    private clientService: ClientService,
    private commerceService: CommerceService,
    private consultationHistoryService?: ConsultationHistoryService
  ) {}

  /**
   * Buscar exámenes en el catálogo
   */
  async searchExams(
    searchTerm?: string,
    type?: ExamType,
    page = 1,
    limit = 50
  ): Promise<{
    exams: MedicalExam[];
    total: number;
    page: number;
    limit: number;
  }> {
    let query = this.examRepository.whereEqualTo('active', true).whereEqualTo('available', true);

    if (type) {
      query = query.whereEqualTo('type', type);
    }

    const allExams = await query.find();

    let filtered = allExams;
    if (searchTerm) {
      filtered = allExams.filter(
        exam =>
          exam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exam.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exam.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      exams: filtered.slice(start, end),
      total: filtered.length,
      page,
      limit,
    };
  }

  /**
   * Obtener examen por ID
   */
  async getExamById(id: string): Promise<MedicalExam> {
    const exam = await this.examRepository.findById(id);
    if (!exam) {
      throw new HttpException('Exam not found', HttpStatus.NOT_FOUND);
    }
    return exam;
  }

  /**
   * Crear orden de exámenes
   */
  async createExamOrder(user: string, createDto: CreateExamOrderDto): Promise<MedicalExamOrder> {
    // Validar que todos los exámenes existan
    for (const exam of createDto.exams) {
      try {
        await this.getExamById(exam.examId);
      } catch (error) {
        throw new HttpException(`Exam ${exam.examId} not found`, HttpStatus.BAD_REQUEST);
      }
    }

    const order = new MedicalExamOrder();
    order.commerceId = createDto.commerceId;
    order.clientId = createDto.clientId;
    order.attentionId = createDto.attentionId;
    order.patientHistoryId = createDto.patientHistoryId;
    order.doctorId = createDto.doctorId;
    order.doctorName = createDto.doctorName;
    order.exams = createDto.exams;
    order.type = createDto.type;
    order.priority = createDto.priority;
    order.status = ExamOrderStatus.PENDING;
    order.clinicalJustification = createDto.clinicalJustification;
    order.requestedAt = new Date();
    order.scheduledDate = createDto.scheduledDate ? new Date(createDto.scheduledDate) : undefined;
    order.laboratoryId = createDto.laboratoryId;
    order.laboratoryName = createDto.laboratoryName;
    order.hl7OrderNumber = createDto.hl7OrderNumber;
    order.hl7PatientId = createDto.hl7PatientId;
    order.results = [];
    order.extensions = [];

    order.active = true;
    order.available = true;
    order.createdAt = new Date();
    order.createdBy = user;
    order.updatedAt = new Date();

    const created = await this.examOrderRepository.create(order);

    // Publicar evento
    const orderCreatedEvent = new MedicalExamOrderCreated(new Date(), created, { user });
    publish(orderCreatedEvent);

    // Generar PDF y QR code (asíncrono, no bloquea la respuesta)
    this.generateExamOrderPdfAsync(created).catch(error => {
      console.error('Error generating exam order PDF:', error);
      // No lanzar error, solo loguear para no bloquear la creación
    });

    // Link to consultation history (asíncrono, no bloquea la respuesta)
    if (this.consultationHistoryService && created.attentionId) {
      this.consultationHistoryService
        .linkExamOrderToConsultation(created.attentionId, created.id, user)
        .catch(error => {
          console.warn(`Error linking exam order to consultation: ${error.message}`);
          // No lanzar error, solo loguear para no bloquear la creación
        });
    }

    return created;
  }

  /**
   * Obtener orden por ID
   */
  async getExamOrderById(id: string): Promise<MedicalExamOrder> {
    const order = await this.examOrderRepository.findById(id);
    if (!order) {
      throw new HttpException('Exam order not found', HttpStatus.NOT_FOUND);
    }
    return order;
  }

  /**
   * Obtener órdenes de un paciente
   */
  async getExamOrdersByClient(commerceId: string, clientId: string): Promise<MedicalExamOrder[]> {
    return await this.examOrderRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .whereEqualTo('available', true)
      .orderByDescending('createdAt')
      .find();
  }

  /**
   * Buscar orden por HL7 order number
   */
  async findExamOrderByHL7OrderNumber(hl7OrderNumber: string): Promise<MedicalExamOrder | null> {
    const orders = await this.examOrderRepository
      .whereEqualTo('hl7OrderNumber', hl7OrderNumber)
      .whereEqualTo('available', true)
      .find();

    return orders.length > 0 ? orders[0] : null;
  }

  /**
   * Buscar órdenes por HL7 patient ID (sin commerceId)
   * Útil para integración HL7
   */
  async findExamOrdersByHL7PatientId(hl7PatientId: string): Promise<MedicalExamOrder[]> {
    return await this.examOrderRepository
      .whereEqualTo('hl7PatientId', hl7PatientId)
      .whereEqualTo('available', true)
      .whereEqualTo('status', ExamOrderStatus.PENDING)
      .orderByDescending('createdAt')
      .find();
  }

  /**
   * Actualizar estado de la orden
   */
  async updateOrderStatus(
    user: string,
    orderId: string,
    status: ExamOrderStatus,
    scheduledDate?: Date
  ): Promise<MedicalExamOrder> {
    const order = await this.getExamOrderById(orderId);

    order.status = status;
    if (scheduledDate) {
      order.scheduledDate = scheduledDate;
    }
    if (status === ExamOrderStatus.COMPLETED) {
      order.completedAt = new Date();
    }
    order.updatedAt = new Date();
    order.updatedBy = user;

    const updated = await this.examOrderRepository.update(order);

    // Publicar evento
    const orderUpdatedEvent = new MedicalExamOrderUpdated(new Date(), updated, { user });
    publish(orderUpdatedEvent);

    return updated;
  }

  /**
   * Agregar resultados de exámenes
   */
  async addExamResults(
    user: string,
    orderId: string,
    results: ExamResult[]
  ): Promise<MedicalExamOrder> {
    const order = await this.getExamOrderById(orderId);

    if (!order.results) {
      order.results = [];
    }

    order.results.push(...results);
    order.status = ExamOrderStatus.COMPLETED;
    order.completedAt = new Date();
    order.updatedAt = new Date();
    order.updatedBy = user;

    const updated = await this.examOrderRepository.update(order);

    // Publicar evento
    const orderCompletedEvent = new MedicalExamOrderCompleted(new Date(), updated, { user });
    publish(orderCompletedEvent);

    return updated;
  }

  /**
   * Generar PDF de orden de examen de forma asíncrona
   */
  private async generateExamOrderPdfAsync(examOrder: MedicalExamOrder): Promise<void> {
    try {
      // Obtener información del paciente
      const client = await this.clientService.getClientById(examOrder.clientId);
      const patientName = `${client.name || ''} ${client.lastName || ''}`.trim();
      const patientIdNumber = client.idNumber || '';

      // Obtener información del comercio
      const commerce = await this.commerceService.getCommerceById(examOrder.commerceId);
      const commerceName = commerce.name || '';
      const commerceAddress = commerce.localeInfo?.address || '';
      const commercePhone = commerce.phone || '';

      // Generar PDF
      const { pdfUrl } = await this.examOrderPdfService.generateExamOrderPdf(
        examOrder,
        patientName,
        patientIdNumber,
        commerceName,
        commerceAddress,
        commercePhone
      );

      // Actualizar orden con URL del PDF
      examOrder.pdfUrl = pdfUrl;
      await this.examOrderRepository.update(examOrder);
    } catch (error) {
      console.error('Error in generateExamOrderPdfAsync:', error);
      // No lanzar error para no bloquear la creación de la orden
    }
  }
}
