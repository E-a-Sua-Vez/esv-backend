import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import * as crypto from 'crypto';

import { ClientService } from '../client/client.service';
import { CommerceService } from '../commerce/commerce.service';
import { ProductService } from '../product/product.service';
import { MessageService } from '../message/message.service';
import { MessageType } from '../message/model/type.enum';
import { ConsultationHistoryService } from '../patient-history/consultation-history.service';
import { GeneratedDocumentService } from '../shared/services/generated-document.service';
import { CollaboratorService } from '../collaborator/collaborator.service';
import { PdfTemplateService } from '../shared/services/pdf-template.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { MedicationSearchDto } from './dto/medication-search.dto';
import { CreateMedicationDto } from './dto/create-medication.dto';
import PrescriptionCreated from './events/PrescriptionCreated';
import PrescriptionDispensed from './events/PrescriptionDispensed';
import PrescriptionRefilled from './events/PrescriptionRefilled';
import PrescriptionUpdated from './events/PrescriptionUpdated';
import MedicationCreated from './events/MedicationCreated';
import MedicationUpdated from './events/MedicationUpdated';
import MedicationDeleted from './events/MedicationDeleted';
import { MedicationCatalog } from './model/medication.entity';
import { PrescriptionStatus } from './model/prescription-status.enum';
import { Prescription, MedicationItem } from './model/prescription.entity';
import { PrescriptionPdfService } from './prescription-pdf.service';

@Injectable()
export class PrescriptionService {
  private readonly logger = new Logger(PrescriptionService.name);

  constructor(
    @InjectRepository(Prescription)
    private prescriptionRepository = getRepository(Prescription),
    @InjectRepository(MedicationCatalog)
    private medicationRepository = getRepository(MedicationCatalog),
    private prescriptionPdfService: PrescriptionPdfService,
    private clientService: ClientService,
    private commerceService: CommerceService,
    private productService: ProductService,
    private messageService: MessageService,
    private consultationHistoryService?: ConsultationHistoryService,
    private generatedDocumentService?: GeneratedDocumentService,
    private collaboratorService?: CollaboratorService,
    private pdfTemplateService?: PdfTemplateService
  ) {}

  /**
   * Buscar medicamentos en el catálogo
   */
  async searchMedications(searchDto: MedicationSearchDto): Promise<{
    medications: MedicationCatalog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { searchTerm, atcCode, activePrinciple, commerceId, page = 1, limit = 20 } = searchDto;

    // Obtener todos los medicamentos activos y disponibles
    const baseQuery = this.medicationRepository
      .whereEqualTo('active', true)
      .whereEqualTo('available', true);

    const allMedications = await baseQuery.find();

    // Filtrar por commerceId: incluir medicamentos globales (sin commerceId) y del comercio específico
    let filtered = allMedications;
    if (commerceId) {
      filtered = allMedications.filter(
        med => !med.commerceId || med.commerceId === commerceId
      );
    }

    if (searchTerm) {
      // Búsqueda por nombre (genérico o comercial) o principio activo
      filtered = filtered.filter(
        med =>
          med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          med.commercialName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          med.activePrinciple.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (atcCode) {
      filtered = filtered.filter(med => med.atcCode === atcCode);
    }

    if (activePrinciple) {
      filtered = filtered.filter(med =>
        med.activePrinciple.toLowerCase().includes(activePrinciple.toLowerCase())
      );
    }

    // Ordenar por nombre
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      medications: filtered.slice(start, end),
      total: filtered.length,
      page,
      limit,
    };
  }
      page,
      limit,
    };
  }

  /**
   * Obtener medicamento por ID
   */
  async getMedicationById(id: string): Promise<MedicationCatalog> {
    const medication = await this.medicationRepository.findById(id);
    if (!medication) {
      throw new HttpException('Medication not found', HttpStatus.NOT_FOUND);
    }
    return medication;
  }

  /**
   * Crear una nueva receta
   */
  async createPrescription(user: string, createDto: CreatePrescriptionDto): Promise<Prescription> {
    // Validar que todos los medicamentos existan
    for (const medication of createDto.medications) {
      try {
        await this.getMedicationById(medication.medicationId);
      } catch (error) {
        throw new HttpException(
          `Medication ${medication.medicationId} not found`,
          HttpStatus.BAD_REQUEST
        );
      }
    }

    // Validar disponibilidad de stock para productos relacionados
    await this.validatePrescriptionStock(user, createDto);

    const prescription = new Prescription();
    prescription.commerceId = createDto.commerceId;
    prescription.clientId = createDto.clientId;
    prescription.attentionId = createDto.attentionId;
    prescription.patientHistoryId = createDto.patientHistoryId;
    prescription.doctorId = createDto.doctorId;
    prescription.doctorName = createDto.doctorName;
    prescription.doctorLicense = createDto.doctorLicense;

    prescription.medications = createDto.medications.map(med => ({
      ...med,
      refillsUsed: 0,
    })) as MedicationItem[];

    prescription.date = new Date(createDto.date);
    prescription.validUntil = new Date(createDto.validUntil);
    prescription.status = PrescriptionStatus.ACTIVE;
    prescription.observations = createDto.observations;
    prescription.instructions = createDto.instructions;

    prescription.totalRefillsAllowed = Math.max(
      ...createDto.medications.map(m => m.refillsAllowed)
    );
    prescription.totalRefillsUsed = 0;
    prescription.dispensations = [];

    prescription.active = true;
    prescription.available = true;
    prescription.createdAt = new Date();
    prescription.createdBy = user;
    prescription.updatedAt = new Date();

    const created = await this.prescriptionRepository.create(prescription);

    // Publicar evento de receta creada
    const prescriptionCreatedEvent = new PrescriptionCreated(new Date(), created, { user });
    publish(prescriptionCreatedEvent);

    // Generar PDF y QR code (asíncrono, no bloquea la respuesta)
    this.generatePrescriptionPdfAsync(created).catch(error => {
      console.error('Error generating prescription PDF:', error);
      // No lanzar error, solo loguear para no bloquear la creación
    });

    // Link to consultation history (asíncrono, no bloquea la respuesta)
    if (this.consultationHistoryService && created.attentionId) {
      this.consultationHistoryService
        .linkPrescriptionToConsultation(created.attentionId, created.id, user)
        .catch(error => {
          this.logger.warn(`Error linking prescription to consultation: ${error.message}`);
          // No lanzar error, solo loguear para no bloquear la creación
        });
    }

    return created;
  }

  /**
   * Generar PDF de receta de forma asíncrona
   */
  private async generatePrescriptionPdfAsync(prescription: Prescription): Promise<void> {
    try {
      // Obtener información del paciente
      const client = await this.clientService.getClientById(prescription.clientId);
      const patientName = `${client.name || ''} ${client.lastName || ''}`.trim();
      const patientIdNumber = client.idNumber || '';

      // Obtener información del comercio
      const commerce = await this.commerceService.getCommerceById(prescription.commerceId);
      const commerceName = commerce.name || '';
      const commerceAddress = commerce.localeInfo?.address || '';
      const commercePhone = commerce.phone || '';

      // Obtener logo del commerce
      const commerceLogo = commerce.logo
        ? `${process.env.BACKEND_URL || ''}${commerce.logo}`
        : undefined;

      // Obtener firma digital del médico (si existe)
      let doctorSignature: string | undefined;
      if (prescription.doctorId) {
        try {
          const collaborator = await this.collaboratorService?.getCollaboratorById(
            prescription.doctorId
          );
          if (collaborator?.digitalSignature) {
            doctorSignature = collaborator.digitalSignature.startsWith('http')
              ? collaborator.digitalSignature
              : `${process.env.BACKEND_URL || ''}${collaborator.digitalSignature}`;
          }
        } catch (error) {
          this.logger.warn(`Could not load doctor signature: ${error.message}`);
        }
      }

      // Obtener template (si existe servicio de templates)
      let template = null;
      if (this.pdfTemplateService) {
        try {
          template = await this.pdfTemplateService.getDefaultTemplate('prescription', commerce.id);
          // Incrementar contador de uso si se encontró un template
          if (template?.id) {
            await this.pdfTemplateService.incrementUsageCount(template.id);
          }
        } catch (error) {
          this.logger.warn(`Could not load PDF template: ${error.message}`);
        }
      }

      // Generar PDF
      const { pdfUrl, qrCode, verificationUrl } =
        await this.prescriptionPdfService.generatePrescriptionPdf(
          prescription,
          patientName,
          patientIdNumber,
          commerceName,
          commerceAddress,
          commercePhone,
          commerceLogo,
          doctorSignature,
          template
        );

      // Calcular hash del documento para verificación de integridad
      const hashData = JSON.stringify({
        id: prescription.id,
        date: prescription.date.toISOString(),
        doctorId: prescription.doctorId,
        doctorLicense: prescription.doctorLicense,
        commerceId: prescription.commerceId,
        clientId: prescription.clientId,
        medications: prescription.medications.map((m) => ({
          medicationId: m.medicationId,
          dosage: m.dosage,
          frequency: m.frequency,
        })),
      });
      const documentHash = crypto.createHash('sha256').update(hashData).digest('hex');

      // Actualizar receta con URL del PDF, QR code y hash del documento
      prescription.pdfUrl = pdfUrl;
      prescription.qrCode = qrCode;
      prescription.documentHash = documentHash;
      await this.prescriptionRepository.update(prescription);

      // Guardar como documento en patient history (si el servicio está disponible)
      if (this.generatedDocumentService && prescription.attentionId) {
        try {
          const pdfKey = `prescriptions/${prescription.commerceId}/${prescription.id}.pdf`;
          const documentName = `Receta Médica - ${patientName} - ${new Date(prescription.date).toLocaleDateString('pt-BR')}`;

          await this.generatedDocumentService.saveGeneratedDocumentAsPatientDocument(
            prescription.createdBy || prescription.doctorId,
            prescription.commerceId,
            prescription.clientId,
            prescription.attentionId,
            'prescription',
            pdfUrl,
            pdfKey,
            documentName,
            {
              prescriptionId: prescription.id,
              doctorName: prescription.doctorName,
              doctorId: prescription.doctorId,
              doctorLicense: prescription.doctorLicense,
            }
          );
        } catch (docError) {
          this.logger.warn(`Error saving prescription as patient document: ${docError.message}`);
          // No lanzar error, solo loguear
        }
      }
    } catch (error) {
      this.logger.error(`Error in generatePrescriptionPdfAsync: ${error.message}`, error.stack);
      // No lanzar error para no bloquear la creación de la receta
    }
  }

  /**
   * Obtener receta por ID
   */
  async getPrescriptionById(id: string): Promise<Prescription> {
    const prescription = await this.prescriptionRepository.findById(id);
    if (!prescription) {
      throw new HttpException('Prescription not found', HttpStatus.NOT_FOUND);
    }
    return prescription;
  }

  /**
   * Obtener recetas de un paciente
   */
  async getPrescriptionsByClient(commerceId: string, clientId: string): Promise<Prescription[]> {
    return await this.prescriptionRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .whereEqualTo('available', true)
      .orderByDescending('createdAt')
      .find();
  }

  /**
   * Obtener recetas activas de un paciente
   */
  async getActivePrescriptionsByClient(
    commerceId: string,
    clientId: string
  ): Promise<Prescription[]> {
    const now = new Date();
    return await this.prescriptionRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .whereEqualTo('status', PrescriptionStatus.ACTIVE)
      .whereEqualTo('available', true)
      .find()
      .then(prescriptions => prescriptions.filter(p => new Date(p.validUntil) >= now));
  }

  /**
   * Refuerzo de receta
   */
  async refillPrescription(
    user: string,
    prescriptionId: string,
    medicationIndex?: number // Si se especifica, solo refuerza ese medicamento
  ): Promise<Prescription> {
    const prescription = await this.getPrescriptionById(prescriptionId);

    // Bloqueio após assinatura (conformidade CFM)
    if (prescription.isSigned) {
      throw new HttpException(
        'Prescrição assinada não pode ser alterada',
        HttpStatus.BAD_REQUEST
      );
    }

    if (prescription.status !== PrescriptionStatus.ACTIVE) {
      throw new HttpException('Only active prescriptions can be refilled', HttpStatus.BAD_REQUEST);
    }

    const now = new Date();
    if (new Date(prescription.validUntil) < now) {
      throw new HttpException('Prescription has expired', HttpStatus.BAD_REQUEST);
    }

    if (medicationIndex !== undefined) {
      // Refuerzo de un medicamento específico
      if (medicationIndex < 0 || medicationIndex >= prescription.medications.length) {
        throw new HttpException('Invalid medication index', HttpStatus.BAD_REQUEST);
      }

      const medication = prescription.medications[medicationIndex];
      if (medication.refillsUsed >= medication.refillsAllowed) {
        throw new HttpException(
          'Maximum refills reached for this medication',
          HttpStatus.BAD_REQUEST
        );
      }

      medication.refillsUsed++;
    } else {
      // Refuerzo de toda la receta
      if (prescription.totalRefillsUsed >= prescription.totalRefillsAllowed) {
        throw new HttpException('Maximum refills reached', HttpStatus.BAD_REQUEST);
      }

      prescription.medications.forEach(med => {
        if (med.refillsUsed < med.refillsAllowed) {
          med.refillsUsed++;
        }
      });
      prescription.totalRefillsUsed++;
    }

    prescription.updatedAt = new Date();
    prescription.updatedBy = user;

    const updated = await this.prescriptionRepository.update(prescription);

    // Publicar evento de refuerzo
    const prescriptionRefilledEvent = new PrescriptionRefilled(new Date(), updated, { user });
    publish(prescriptionRefilledEvent);

    return updated;
  }

  /**
   * Registrar dispensación
   */
  async recordDispensation(
    user: string,
    prescriptionId: string,
    dispensationData: {
      pharmacy?: string;
      pharmacist?: string;
      quantity: number;
      notes?: string;
    }
  ): Promise<Prescription> {
    const prescription = await this.getPrescriptionById(prescriptionId);

    // Bloqueio após assinatura (conformidade CFM)
    // Nota: Dispensação pode ser registrada mesmo após assinatura, mas não altera o documento
    // Se necessário bloquear também dispensação, descomentar:
    // if (prescription.isSigned) {
    //   throw new HttpException(
    //     'Prescrição assinada não pode ser alterada',
    //     HttpStatus.BAD_REQUEST
    //   );
    // }

    const dispensation = {
      id: `disp-${Date.now()}`,
      date: new Date(),
      ...dispensationData,
    };

    prescription.dispensations.push(dispensation);
    prescription.updatedAt = new Date();
    prescription.updatedBy = user;

    // Si es la primera dispensación, cambiar estado
    if (prescription.dispensations.length === 1) {
      prescription.status = PrescriptionStatus.DISPENSED;
    }

    const updated = await this.prescriptionRepository.update(prescription);

    // Publicar evento de dispensación
    const prescriptionDispensedEvent = new PrescriptionDispensed(new Date(), updated, { user });
    publish(prescriptionDispensedEvent);

    return updated;
  }

  /**
   * Cancelar receta
   */
  async cancelPrescription(
    user: string,
    prescriptionId: string,
    reason?: string
  ): Promise<Prescription> {
    const prescription = await this.getPrescriptionById(prescriptionId);

    // Bloqueio após assinatura (conformidade CFM)
    if (prescription.isSigned) {
      throw new HttpException(
        'Prescrição assinada não pode ser cancelada',
        HttpStatus.BAD_REQUEST
      );
    }

    if (prescription.status === PrescriptionStatus.CANCELLED) {
      throw new HttpException('Prescription is already cancelled', HttpStatus.BAD_REQUEST);
    }

    prescription.status = PrescriptionStatus.CANCELLED;
    prescription.updatedAt = new Date();
    prescription.updatedBy = user;

    if (reason) {
      prescription.observations = `${prescription.observations || ''}\n[Cancelled: ${reason}]`;
    }

    const updated = await this.prescriptionRepository.update(prescription);

    // Publicar evento de actualización (cancelación)
    const prescriptionUpdatedEvent = new PrescriptionUpdated(new Date(), updated, { user });
    publish(prescriptionUpdatedEvent);

    return updated;
  }

  /**
   * Validar interacciones medicamentosas básicas
   * TODO: Integrar con base de datos de interacciones
   */
  async validateMedicationInteractions(medicationIds: string[]): Promise<{
    hasInteractions: boolean;
    interactions: Array<{
      medication1: string;
      medication2: string;
      severity: 'mild' | 'moderate' | 'severe';
      description: string;
    }>;
  }> {
    // Por ahora retornamos estructura vacía
    // TODO: Implementar lógica de validación real
    return {
      hasInteractions: false,
      interactions: [],
    };
  }

  /**
   * Validar disponibilidad de stock para productos relacionados con la prescripción
   */
  private async validatePrescriptionStock(
    user: string,
    createDto: CreatePrescriptionDto
  ): Promise<void> {
    const stockWarnings: string[] = [];

    for (const medication of createDto.medications) {
      // Buscar productos relacionados por nombre
      const matchingProducts = await this.productService.findProductsByName(
        createDto.commerceId,
        medication.medicationName
      );

      if (matchingProducts.length > 0) {
        // Verificar stock para cada producto encontrado
        for (const product of matchingProducts) {
          if (product.actualLevel !== undefined && product.actualLevel < medication.quantity) {
            const message = `⚠️ Stock insuficiente: ${product.name} tiene ${product.actualLevel} unidades, pero se prescribieron ${medication.quantity}.`;
            stockWarnings.push(message);

            // Enviar alerta si el stock está por debajo del nivel de reposición
            if (
              product.replacementLevel !== undefined &&
              product.actualLevel <= product.replacementLevel
            ) {
              await this.messageService.sendMessageToAdministrator(
                user,
                createDto.commerceId,
                MessageType.STOCK_PRODUCT_RECHARGE,
                `Producto ${product.name} tiene stock bajo (${product.actualLevel} unidades) y se ha prescrito en una receta.`
              );
            }
          }
        }
      } else {
        // No se encontró producto relacionado - podría ser una advertencia
        this.logger.warn(
          `No se encontró producto relacionado para medicamento: ${medication.medicationName}`
        );
      }
    }

    // Si hay advertencias críticas, lanzar excepción (opcional)
    // Por ahora solo logueamos las advertencias
    if (stockWarnings.length > 0) {
      this.logger.warn(`Stock warnings for prescription: ${stockWarnings.join('; ')}`);
    }
  }

  /**
   * Obtener sugerencias de prescripciones activas para una atención
   * Retorna productos prescritos con información de disponibilidad de stock
   */
  async getPrescriptionSuggestionsForAttention(
    commerceId: string,
    clientId: string,
    attentionId: string
  ): Promise<
    Array<{
      prescriptionId: string;
      medication: MedicationItem;
      matchingProducts: Array<{
        productId: string;
        productName: string;
        actualLevel: number;
        available: boolean;
        canConsume: boolean;
      }>;
    }>
  > {
    // Obtener prescripciones activas del cliente
    const activePrescriptions = await this.getActivePrescriptionsByClient(commerceId, clientId);

    const suggestions: Array<{
      prescriptionId: string;
      medication: MedicationItem;
      matchingProducts: Array<{
        productId: string;
        productName: string;
        actualLevel: number;
        available: boolean;
        canConsume: boolean;
      }>;
    }> = [];

    for (const prescription of activePrescriptions) {
      // Solo considerar prescripciones relacionadas con esta atención o sin atención específica
      if (prescription.attentionId && prescription.attentionId !== attentionId) {
        continue;
      }

      for (const medication of prescription.medications) {
        // Buscar productos relacionados
        const matchingProducts = await this.productService.findProductsByName(
          commerceId,
          medication.medicationName
        );

        const productSuggestions = matchingProducts.map(product => ({
          productId: product.id,
          productName: product.name || '',
          actualLevel: product.actualLevel || 0,
          available: (product.actualLevel || 0) >= medication.quantity,
          canConsume: (product.actualLevel || 0) >= medication.quantity,
        }));

        if (productSuggestions.length > 0) {
          suggestions.push({
            prescriptionId: prescription.id,
            medication,
            matchingProducts: productSuggestions,
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Obtener todos los medicamentos
   */
  async getAllMedications(): Promise<MedicationCatalog[]> {
    return await this.medicationRepository
      .whereEqualTo('active', true)
      .orderByAscending('name')
      .find();
  }

  /**
   * Obtener medicamentos por commerce
   */
  async getMedicationsByCommerce(commerceId: string): Promise<MedicationCatalog[]> {
    return await this.medicationRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .orderByAscending('name')
      .find();
  }

  /**
   * Crear medicamento
   */
  async createMedication(user: string, createDto: CreateMedicationDto): Promise<MedicationCatalog> {
    const medication = new MedicationCatalog();
    medication.commerceId = createDto.commerceId;
    medication.name = createDto.name;
    medication.commercialName = createDto.commercialName;
    medication.atcCode = createDto.atcCode;
    medication.activePrinciple = createDto.activePrinciple;
    medication.presentation = createDto.presentation;
    medication.dosageForm = createDto.dosageForm;
    medication.route = createDto.route;
    medication.standardDosage = createDto.standardDosage;
    medication.contraindications = createDto.contraindications || [];
    medication.interactions = createDto.interactions || [];
    medication.active = createDto.active !== undefined ? createDto.active : true;
    medication.available = createDto.available !== undefined ? createDto.available : true;
    medication.createdAt = new Date();
    medication.updatedAt = new Date();

    const created = await this.medicationRepository.create(medication);

    // Publicar evento de medicamento creado
    const medicationCreatedEvent = new MedicationCreated(new Date(), created, { user });
    publish(medicationCreatedEvent);

    return created;
  }

  /**
   * Actualizar medicamento
   */
  async updateMedication(id: string, updateDto: any, userId?: string): Promise<MedicationCatalog> {
    const medication = await this.getMedicationById(id);

    if (updateDto.name !== undefined) medication.name = updateDto.name;
    if (updateDto.commercialName !== undefined) medication.commercialName = updateDto.commercialName;
    if (updateDto.atcCode !== undefined) medication.atcCode = updateDto.atcCode;
    if (updateDto.activePrinciple !== undefined) medication.activePrinciple = updateDto.activePrinciple;
    if (updateDto.presentation !== undefined) medication.presentation = updateDto.presentation;
    if (updateDto.dosageForm !== undefined) medication.dosageForm = updateDto.dosageForm;
    if (updateDto.route !== undefined) medication.route = updateDto.route;
    if (updateDto.standardDosage !== undefined) medication.standardDosage = updateDto.standardDosage;
    if (updateDto.contraindications !== undefined) medication.contraindications = updateDto.contraindications;
    if (updateDto.interactions !== undefined) medication.interactions = updateDto.interactions;
    if (updateDto.active !== undefined) medication.active = updateDto.active;
    if (updateDto.available !== undefined) medication.available = updateDto.available;
    medication.updatedAt = new Date();

    const updated = await this.medicationRepository.update(medication);

    // Publicar evento de medicamento actualizado
    const medicationUpdatedEvent = new MedicationUpdated(new Date(), updated, { user: userId || 'system' });
    publish(medicationUpdatedEvent);

    return updated;
  }

  /**
   * Eliminar medicamento (soft delete)
   */
  async deleteMedication(id: string, userId?: string): Promise<void> {
    const medication = await this.getMedicationById(id);
    medication.active = false;
    medication.available = false;
    medication.updatedAt = new Date();
    const deleted = await this.medicationRepository.update(medication);

    // Publicar evento de medicamento eliminado
    const medicationDeletedEvent = new MedicationDeleted(new Date(), deleted, { user: userId || 'system' });
    publish(medicationDeletedEvent);
  }
}
