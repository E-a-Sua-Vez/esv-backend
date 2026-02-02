import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import * as crypto from 'crypto';

import { ClientService } from '../client/client.service';
import { CommerceService } from '../commerce/commerce.service';
import { ConsultationHistoryService } from '../patient-history/consultation-history.service';
import { GeneratedDocumentService } from '../shared/services/generated-document.service';
import { CollaboratorService } from '../collaborator/collaborator.service';
import { PdfTemplateService } from '../shared/services/pdf-template.service';

import { CreateExamOrderDto } from './dto/create-exam-order.dto';
import MedicalExamOrderCompleted from './events/MedicalExamOrderCompleted';
import MedicalExamOrderCreated from './events/MedicalExamOrderCreated';
import MedicalExamOrderUpdated from './events/MedicalExamOrderUpdated';
import MedicalExamCreated from './events/MedicalExamCreated';
import MedicalExamUpdated from './events/MedicalExamUpdated';
import MedicalExamDeleted from './events/MedicalExamDeleted';
import { MedicalExamOrderPdfService } from './medical-exam-order-pdf.service';
import { ExamOrderStatus, ExamPriority, ExamType } from './model/exam-order-status.enum';
import { MedicalExamOrder, ExamResult } from './model/medical-exam-order.entity';
import { MedicalExam } from './model/medical-exam.entity';

@Injectable()
export class MedicalExamOrderService {
  private readonly logger = new Logger(MedicalExamOrderService.name);

  constructor(
    @InjectRepository(MedicalExamOrder)
    private examOrderRepository = getRepository(MedicalExamOrder),
    @InjectRepository(MedicalExam)
    private examRepository = getRepository(MedicalExam),
    private examOrderPdfService: MedicalExamOrderPdfService,
    private clientService: ClientService,
    private commerceService: CommerceService,
    private consultationHistoryService?: ConsultationHistoryService,
    private generatedDocumentService?: GeneratedDocumentService,
    private collaboratorService?: CollaboratorService,
    private pdfTemplateService?: PdfTemplateService
  ) {}

  /**
   * Buscar exámenes en el catálogo
   */
  async searchExams(
    searchTerm?: string,
    type?: ExamType,
    commerceId?: string,
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

    // Filter by commerceId: include global exams (no commerceId) and commerce-specific exams
    let filtered = allExams;
    if (commerceId) {
      filtered = allExams.filter(
        exam => !exam.commerceId || exam.commerceId === commerceId
      );
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        exam =>
          exam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exam.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exam.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort by name
    filtered.sort((a, b) => a.name.localeCompare(b.name));

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
    // Validación: Debe tener al menos professionalId o collaboratorId
    if (!createDto.professionalId && !createDto.collaboratorId) {
      this.logger.warn('Creating exam order without professionalId or collaboratorId');
    }

    // Auto-resolución: Si solo tiene collaboratorId, intentar obtener professionalId vinculado
    if (createDto.collaboratorId && !createDto.professionalId && this.collaboratorService) {
      try {
        const collaborator = await this.collaboratorService.getCollaboratorById(createDto.collaboratorId);
        if (collaborator?.professionalId) {
          createDto.professionalId = collaborator.professionalId;
        }
      } catch (error) {
        console.warn(`Could not auto-resolve professionalId from collaboratorId ${createDto.collaboratorId}: ${error.message}`);
      }
    }

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
    order.collaboratorId = createDto.collaboratorId;
    order.professionalId = createDto.professionalId;
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

    // Bloqueio após assinatura (conformidade CFM)
    if (order.isSigned) {
      throw new HttpException(
        'Ordem de exame assinada não pode ser alterada',
        HttpStatus.BAD_REQUEST
      );
    }

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

    // Bloqueio após assinatura (conformidade CFM)
    // Nota: Resultados podem ser adicionados mesmo após assinatura, mas não alteram o documento original
    // Se necessário bloquear também resultados, descomentar:
    // if (order.isSigned) {
    //   throw new HttpException(
    //     'Ordem de exame assinada não pode ser alterada',
    //     HttpStatus.BAD_REQUEST
    //   );
    // }

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
      const commerceLogo = commerce.logo
        ? `${process.env.BACKEND_URL || ''}${commerce.logo}`
        : undefined;

      // Obtener firma digital y CRM del médico (si existe)
      let doctorSignature: string | undefined;
      let doctorLicense: string | undefined;
      if (examOrder.doctorId) {
        try {
          const collaborator = await this.collaboratorService?.getCollaboratorById(
            examOrder.doctorId
          );
          if (collaborator) {
            // Acceder a medicalData si está disponible
            const medicalData = (collaborator as any)?.medicalData;
            // Obtener firma digital
            if (medicalData?.digitalSignature) {
              doctorSignature = medicalData.digitalSignature.startsWith('http')
                ? medicalData.digitalSignature
                : `${process.env.BACKEND_URL || ''}${medicalData.digitalSignature}`;
            }
            // Obtener CRM (licencia médica)
            if (medicalData?.medicalLicense) {
              doctorLicense = medicalData.medicalLicenseState
                ? `CRM/${medicalData.medicalLicenseState} ${medicalData.medicalLicense}`
                : `CRM ${medicalData.medicalLicense}`;
            }
          }
        } catch (error) {
          console.warn(`Could not load doctor data: ${error.message}`);
        }
      }

      // Obtener template (si existe servicio de templates)
      let template = null;
      if (this.pdfTemplateService) {
        try {
          template = await this.pdfTemplateService.getDefaultTemplate('exam_order', commerce.id);
          // Incrementar contador de uso si se encontró un template
          if (template?.id) {
            await this.pdfTemplateService.incrementUsageCount(template.id);
          }
        } catch (error) {
          console.warn(`Could not load PDF template: ${error.message}`);
        }
      }

      // Generar PDF
      const { pdfUrl, verificationUrl } = await this.examOrderPdfService.generateExamOrderPdf(
        examOrder,
        patientName,
        patientIdNumber,
        commerceName,
        commerceAddress,
        commercePhone,
        commerceLogo,
        doctorSignature,
        template,
        doctorLicense // Pasar CRM del colaborador
      );

      // Calcular hash del documento para verificación de integridad
      const hashData = JSON.stringify({
        id: examOrder.id,
        date: examOrder.requestedAt.toISOString(),
        doctorId: examOrder.doctorId,
        commerceId: examOrder.commerceId,
        clientId: examOrder.clientId,
        exams: examOrder.exams.map((e) => ({
          examId: e.examId,
          examName: e.examName,
        })),
      });
      const documentHash = crypto.createHash('sha256').update(hashData).digest('hex');

      // Actualizar orden con URL del PDF y hash del documento
      examOrder.pdfUrl = pdfUrl;
      examOrder.documentHash = documentHash;
      await this.examOrderRepository.update(examOrder);

      // Guardar como documento en patient history (si el servicio está disponible)
      if (this.generatedDocumentService && examOrder.attentionId) {
        try {
          const pdfKey = `exam-orders/${examOrder.commerceId}/${examOrder.id}.pdf`;
          const documentName = `Orden de Exámenes - ${patientName} - ${new Date(examOrder.requestedAt).toLocaleDateString('pt-BR')}`;

          await this.generatedDocumentService.saveGeneratedDocumentAsPatientDocument(
            examOrder.createdBy || examOrder.doctorId,
            examOrder.commerceId,
            examOrder.clientId,
            examOrder.attentionId,
            'exam_order',
            pdfUrl,
            pdfKey,
            documentName,
            {
              examOrderId: examOrder.id,
              doctorName: examOrder.doctorName,
              doctorId: examOrder.doctorId,
              clinicalJustification: examOrder.clinicalJustification,
            }
          );
        } catch (docError) {
          console.warn(`Error saving exam order as patient document: ${docError.message}`);
          // No lanzar error, solo loguear
        }
      }
    } catch (error) {
      console.error('Error in generateExamOrderPdfAsync:', error);
      // No lanzar error para no bloquear la creación de la orden
    }
  }

  /**
   * Obtener todos los exámenes
   */
  async getAllExams(): Promise<MedicalExam[]> {
    return await this.examRepository
      .whereEqualTo('active', true)
      .orderByAscending('name')
      .find();
  }

  /**
   * Obtener exámenes por commerce
   */
  async getExamsByCommerce(commerceId: string): Promise<MedicalExam[]> {
    return await this.examRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .orderByAscending('name')
      .find();
  }

  /**
   * Crear examen médico
   */
  async createMedicalExam(user: string, createDto: any): Promise<MedicalExam> {
    const exam = new MedicalExam();
    exam.commerceId = createDto.commerceId; // ✅ Asignación de commerceId
    exam.name = createDto.name;
    exam.code = createDto.code;
    exam.type = createDto.type;
    exam.category = createDto.category;
    exam.description = createDto.description;
    exam.preparation = createDto.preparation;
    exam.estimatedDuration = createDto.estimatedDuration;
    exam.cost = createDto.cost;
    exam.active = createDto.active !== undefined ? createDto.active : true;
    exam.available = createDto.available !== undefined ? createDto.available : true;
    exam.createdAt = new Date();
    exam.updatedAt = new Date();

    const created = await this.examRepository.create(exam);

    // ✅ Publicar evento de examen creado
    const examCreatedEvent = new MedicalExamCreated(new Date(), created, { user });
    publish(examCreatedEvent);

    return created;
  }

  /**
   * Actualizar examen médico
   */
  async updateMedicalExam(id: string, updateDto: any, userId?: string): Promise<MedicalExam> {
    const exam = await this.getExamById(id);

    if (updateDto.name !== undefined) exam.name = updateDto.name;
    if (updateDto.code !== undefined) exam.code = updateDto.code;
    if (updateDto.type !== undefined) exam.type = updateDto.type;
    if (updateDto.category !== undefined) exam.category = updateDto.category;
    if (updateDto.description !== undefined) exam.description = updateDto.description;
    if (updateDto.preparation !== undefined) exam.preparation = updateDto.preparation;
    if (updateDto.estimatedDuration !== undefined) exam.estimatedDuration = updateDto.estimatedDuration;
    if (updateDto.cost !== undefined) exam.cost = updateDto.cost;
    if (updateDto.active !== undefined) exam.active = updateDto.active;
    if (updateDto.available !== undefined) exam.available = updateDto.available;
    exam.updatedAt = new Date();

    const updated = await this.examRepository.update(exam);

    // ✅ Publicar evento de examen actualizado
    const examUpdatedEvent = new MedicalExamUpdated(new Date(), updated, { user: userId || 'system' });
    publish(examUpdatedEvent);

    return updated;
  }

  /**
   * Eliminar examen médico (soft delete)
   */
  async deleteMedicalExam(id: string, userId?: string): Promise<void> {
    const exam = await this.getExamById(id);
    exam.active = false;
    exam.available = false;
    exam.updatedAt = new Date();
    const deleted = await this.examRepository.update(exam);

    // ✅ Publicar evento de examen eliminado
    const examDeletedEvent = new MedicalExamDeleted(new Date(), deleted, { user: userId || 'system' });
    publish(examDeletedEvent);
  }
}
