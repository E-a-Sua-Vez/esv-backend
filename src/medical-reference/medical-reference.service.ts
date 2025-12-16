import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { ClientService } from '../client/client.service';
import { CommerceService } from '../commerce/commerce.service';

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
    private commerceService: CommerceService
  ) {}

  /**
   * Crear referencia médica
   */
  async createReference(
    user: string,
    createDto: CreateMedicalReferenceDto
  ): Promise<MedicalReference> {
    const reference = new MedicalReference();
    reference.commerceId = createDto.commerceId;
    reference.clientId = createDto.clientId;
    reference.attentionId = createDto.attentionId;
    reference.patientHistoryId = createDto.patientHistoryId;
    reference.doctorOriginId = createDto.doctorOriginId;
    reference.doctorOriginName = createDto.doctorOriginName;
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

      // Generar PDF
      const { pdfUrl } = await this.referencePdfService.generateReferencePdf(
        reference,
        patientName,
        patientIdNumber,
        commerceName,
        commerceAddress,
        commercePhone
      );

      // Actualizar referencia con URL del PDF
      reference.pdfUrl = pdfUrl;
      await this.referenceRepository.update(reference);
    } catch (error) {
      console.error('Error in generateReferencePdfAsync:', error);
      // No lanzar error para no bloquear la creación de la referencia
    }
  }
}
