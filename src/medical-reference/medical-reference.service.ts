import { HttpException, HttpStatus, Injectable, Inject, forwardRef } from '@nestjs/common';
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

import { CreateMedicalReferenceDto } from './dto/create-medical-reference.dto';
import MedicalReferenceAccepted from './events/MedicalReferenceAccepted';
import MedicalReferenceAttended from './events/MedicalReferenceAttended';
import MedicalReferenceCreated from './events/MedicalReferenceCreated';
import MedicalReferenceUpdated from './events/MedicalReferenceUpdated';
import { MedicalReferencePdfService } from './medical-reference-pdf.service';
import {
  MedicalReference,
  ReferenceStatus,
  ReferenceUrgency,
} from './model/medical-reference.entity';

@Injectable()
export class MedicalReferenceService {
  constructor(
    @InjectRepository(MedicalReference)
    private referenceRepository = getRepository(MedicalReference),
    private referencePdfService: MedicalReferencePdfService,
    private clientService: ClientService,
    private commerceService: CommerceService,
    @Inject(forwardRef(() => ConsultationHistoryService))
    private consultationHistoryService?: ConsultationHistoryService,
    private generatedDocumentService?: GeneratedDocumentService,
    private collaboratorService?: CollaboratorService,
    private pdfTemplateService?: PdfTemplateService
  ) {}

  /**
   * Crear referencia médica
   */
  async createReference(
    user: string,
    createDto: CreateMedicalReferenceDto
  ): Promise<MedicalReference> {
    // Validación: Debe tener al menos professionalId o collaboratorId
    if (!createDto.professionalId && !createDto.collaboratorId) {
      console.warn('Creating reference without professionalId or collaboratorId');
    }

    // Auto-resolución: Si solo tiene collaboratorId, intentar obtener professionalId vinculado
    if (createDto.collaboratorId && !createDto.professionalId && this.collaboratorService) {
      try {
        const collaborator = await this.collaboratorService.getCollaboratorById(createDto.collaboratorId);
        if (collaborator?.professionalId) {
          createDto.professionalId = collaborator.professionalId;
          console.log(`Auto-resolved professionalId ${createDto.professionalId} from collaboratorId ${createDto.collaboratorId}`);
        }
      } catch (error) {
        console.warn(`Could not auto-resolve professionalId from collaboratorId ${createDto.collaboratorId}: ${error.message}`);
      }
    }

    const reference = new MedicalReference();
    reference.commerceId = createDto.commerceId;
    reference.clientId = createDto.clientId;
    reference.attentionId = createDto.attentionId;
    reference.patientHistoryId = createDto.patientHistoryId;
    reference.doctorOriginId = createDto.doctorOriginId;
    reference.doctorOriginName = createDto.doctorOriginName;
    reference.collaboratorId = createDto.collaboratorId;
    reference.professionalId = createDto.professionalId;
    reference.doctorDestinationId = createDto.doctorDestinationId;
    reference.doctorDestinationName = createDto.doctorDestinationName;
    reference.specialtyDestination = createDto.specialtyDestination;
    reference.reason = createDto.reason;
    reference.presumptiveDiagnosis = createDto.presumptiveDiagnosis;
    reference.studiesPerformed = createDto.studiesPerformed;
    reference.currentTreatment = createDto.currentTreatment;
    reference.urgency = createDto.urgency;
    reference.status = ReferenceStatus.PENDING;
    reference.referenceDate = new Date();
    reference.attachedDocuments = createDto.attachedDocuments || [];

    reference.active = true;
    reference.available = true;
    reference.createdAt = new Date();
    reference.createdBy = user;
    reference.updatedAt = new Date();

    const created = await this.referenceRepository.create(reference);

    // Publicar evento
    const referenceCreatedEvent = new MedicalReferenceCreated(new Date(), created, { user });
    publish(referenceCreatedEvent);

    // Generar PDF y QR code (asíncrono, no bloquea la respuesta)
    this.generateReferencePdfAsync(created).catch(error => {
      console.error('Error generating reference PDF:', error);
      // No lanzar error, solo loguear para no bloquear la creación
    });

    // Link to consultation history (asíncrono, no bloquea la respuesta)
    if (this.consultationHistoryService && created.attentionId) {
      this.consultationHistoryService
        .linkReferenceToConsultation(created.attentionId, created.id, user)
        .catch(error => {
          console.warn(`Error linking reference to consultation: ${error.message}`);
          // No lanzar error, solo loguear para no bloquear la creación
        });
    }

    return created;
  }

  /**
   * Obtener referencia por ID
   */
  async getReferenceById(id: string): Promise<MedicalReference> {
    const reference = await this.referenceRepository.findById(id);
    if (!reference) {
      throw new HttpException('Reference not found', HttpStatus.NOT_FOUND);
    }
    return reference;
  }

  /**
   * Obtener referencias de un paciente
   */
  async getReferencesByClient(commerceId: string, clientId: string): Promise<MedicalReference[]> {
    return await this.referenceRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .whereEqualTo('available', true)
      .orderByDescending('createdAt')
      .find();
  }

  /**
   * Aceptar referencia
   */
  async acceptReference(
    user: string,
    referenceId: string,
    response?: string
  ): Promise<MedicalReference> {
    const reference = await this.getReferenceById(referenceId);

    // Bloqueio após assinatura (conformidade CFM)
    if (reference.isSigned) {
      throw new HttpException(
        'Referência assinada não pode ser alterada',
        HttpStatus.BAD_REQUEST
      );
    }

    if (reference.status !== ReferenceStatus.PENDING) {
      throw new HttpException('Only pending references can be accepted', HttpStatus.BAD_REQUEST);
    }

    reference.status = ReferenceStatus.ACCEPTED;
    reference.acceptedAt = new Date();
    reference.response = response;
    reference.updatedAt = new Date();
    reference.updatedBy = user;

    const updated = await this.referenceRepository.update(reference);

    // Publicar evento
    const referenceAcceptedEvent = new MedicalReferenceAccepted(new Date(), updated, { user });
    publish(referenceAcceptedEvent);

    return updated;
  }

  /**
   * Marcar referencia como atendida
   */
  async markReferenceAsAttended(
    user: string,
    referenceId: string,
    returnReport?: string
  ): Promise<MedicalReference> {
    const reference = await this.getReferenceById(referenceId);

    // Bloqueio após assinatura (conformidade CFM)
    // Nota: Relatório de retorno pode ser adicionado mesmo após assinatura
    // Se necessário bloquear também, descomentar:
    // if (reference.isSigned) {
    //   throw new HttpException(
    //     'Referência assinada não pode ser alterada',
    //     HttpStatus.BAD_REQUEST
    //   );
    // }

    if (reference.status !== ReferenceStatus.ACCEPTED) {
      throw new HttpException(
        'Only accepted references can be marked as attended',
        HttpStatus.BAD_REQUEST
      );
    }

    reference.status = ReferenceStatus.ATTENDED;
    reference.attendedAt = new Date();
    reference.returnReport = returnReport;
    reference.updatedAt = new Date();
    reference.updatedBy = user;

    const updated = await this.referenceRepository.update(reference);

    // Publicar evento
    const referenceAttendedEvent = new MedicalReferenceAttended(new Date(), updated, { user });
    publish(referenceAttendedEvent);

    return updated;
  }

  /**
   * Rechazar referencia
   */
  async rejectReference(
    user: string,
    referenceId: string,
    reason?: string
  ): Promise<MedicalReference> {
    const reference = await this.getReferenceById(referenceId);

    // Bloqueio após assinatura (conformidade CFM)
    if (reference.isSigned) {
      throw new HttpException(
        'Referência assinada não pode ser rejeitada',
        HttpStatus.BAD_REQUEST
      );
    }

    reference.status = ReferenceStatus.REJECTED;
    reference.response = reason;
    reference.updatedAt = new Date();
    reference.updatedBy = user;

    const updated = await this.referenceRepository.update(reference);

    // Publicar evento
    const referenceUpdatedEvent = new MedicalReferenceUpdated(new Date(), updated, { user });
    publish(referenceUpdatedEvent);

    return updated;
  }

  /**
   * Generar PDF de referencia médica de forma asíncrona
   */
  private async generateReferencePdfAsync(reference: MedicalReference): Promise<void> {
    try {
      // Obtener información del paciente
      const client = await this.clientService.getClientById(reference.clientId);
      const patientName = `${client.name || ''} ${client.lastName || ''}`.trim();
      const patientIdNumber = client.idNumber || '';

      // Obtener información del comercio
      const commerce = await this.commerceService.getCommerceById(reference.commerceId);
      const commerceName = commerce.name || '';
      const commerceAddress = commerce.localeInfo?.address || '';
      const commercePhone = commerce.phone || '';
      const commerceLogo = commerce.logo
        ? `${process.env.BACKEND_URL || ''}${commerce.logo}`
        : undefined;

      // Obtener firma digital y CRM del médico (si existe)
      let doctorSignature: string | undefined;
      let doctorLicense: string | undefined;
      if (reference.doctorOriginId) {
        try {
          const collaborator = await this.collaboratorService?.getCollaboratorById(
            reference.doctorOriginId
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
          template = await this.pdfTemplateService.getDefaultTemplate('reference', commerce.id);
          // Incrementar contador de uso si se encontró un template
          if (template?.id) {
            await this.pdfTemplateService.incrementUsageCount(template.id);
          }
        } catch (error) {
          console.warn(`Could not load PDF template: ${error.message}`);
        }
      }

      // Generar PDF
      const { pdfUrl, verificationUrl } = await this.referencePdfService.generateReferencePdf(
        reference,
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
        id: reference.id,
        date: reference.referenceDate.toISOString(),
        doctorOriginId: reference.doctorOriginId,
        commerceId: reference.commerceId,
        clientId: reference.clientId,
        specialtyDestination: reference.specialtyDestination,
      });
      const documentHash = crypto.createHash('sha256').update(hashData).digest('hex');

      // Actualizar referencia con URL del PDF y hash del documento
      reference.pdfUrl = pdfUrl;
      reference.documentHash = documentHash;
      await this.referenceRepository.update(reference);

      // Guardar como documento en patient history (si el servicio está disponible)
      if (this.generatedDocumentService && reference.attentionId) {
        try {
          const pdfKey = `medical-references/${reference.commerceId}/${reference.id}.pdf`;
          const documentName = `Referencia Médica - ${patientName} - ${new Date(reference.referenceDate).toLocaleDateString('pt-BR')}`;

          await this.generatedDocumentService.saveGeneratedDocumentAsPatientDocument(
            reference.createdBy || reference.doctorOriginId,
            reference.commerceId,
            reference.clientId,
            reference.attentionId,
            'reference',
            pdfUrl,
            pdfKey,
            documentName,
            {
              referenceId: reference.id,
              doctorName: reference.doctorOriginName,
              doctorId: reference.doctorOriginId,
              specialty: reference.specialtyDestination,
              reason: reference.reason,
            }
          );
        } catch (docError) {
          console.warn(`Error saving reference as patient document: ${docError.message}`);
          // No lanzar error, solo loguear
        }
      }
    } catch (error) {
      console.error('Error in generateReferencePdfAsync:', error);
      // No lanzar error para no bloquear la creación de la referencia
    }
  }
}
