import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import ConsultationHistoryCreated from './events/ConsultationHistoryCreated';
import ConsultationHistoryUpdated from './events/ConsultationHistoryUpdated';
import { ConsultationHistory } from './model/consultation-history.entity';
import {
  ConsultationReason,
  CurrentIllness,
  Diagnostic,
  FunctionalExam,
  MedicalOrder,
  PatientAnamnese,
  PhysicalExam,
  Control,
  PatientDocument,
} from './model/patient-history.entity';

@Injectable()
export class ConsultationHistoryService {
  constructor(
    @InjectRepository(ConsultationHistory)
    private consultationHistoryRepository = getRepository(ConsultationHistory)
  ) {}

  /**
   * Create or update a consultation history record
   */
  public async saveConsultationHistory(
    user: string,
    patientHistoryId: string,
    commerceId: string,
    clientId: string,
    attentionId: string,
    consultationReason: ConsultationReason[],
    currentIllness: CurrentIllness[],
    patientAnamnese: PatientAnamnese[],
    functionalExam: FunctionalExam[],
    physicalExam: PhysicalExam[],
    diagnostic: Diagnostic[],
    medicalOrder: MedicalOrder[],
    control: Control[],
    patientDocument: PatientDocument[],
    prescriptionIds: string[] = [],
    examOrderIds: string[] = [],
    referenceIds: string[] = [],
    bookingId?: string,
    controlId?: string,
    originalAttentionId?: string
  ): Promise<ConsultationHistory> {
    // Check if consultation history already exists for this attentionId
    // First try with both attentionId and patientHistoryId
    let consultationHistory = await this.consultationHistoryRepository
      .whereEqualTo('attentionId', attentionId)
      .whereEqualTo('patientHistoryId', patientHistoryId)
      .whereEqualTo('available', true)
      .findOne();

    // If not found, try with just attentionId (in case patientHistoryId changed)
    if (!consultationHistory || !consultationHistory.id) {
      consultationHistory = await this.consultationHistoryRepository
        .whereEqualTo('attentionId', attentionId)
        .whereEqualTo('available', true)
        .findOne();

      // If found but patientHistoryId doesn't match, update it
      if (
        consultationHistory &&
        consultationHistory.id &&
        consultationHistory.patientHistoryId !== patientHistoryId
      ) {
        consultationHistory.patientHistoryId = patientHistoryId;
      }
    }

    if (consultationHistory && consultationHistory.id) {
      // Update existing - replace arrays if provided (they're already filtered by attentionId)
      if (consultationReason !== undefined) {
        consultationHistory.consultationReason = consultationReason;
      }
      if (currentIllness !== undefined) {
        consultationHistory.currentIllness = currentIllness;
      }
      if (patientAnamnese !== undefined) {
        consultationHistory.patientAnamnese = patientAnamnese;
      }
      if (functionalExam !== undefined) {
        consultationHistory.functionalExam = functionalExam;
      }
      if (physicalExam !== undefined) {
        consultationHistory.physicalExam = physicalExam;
      }
      if (diagnostic !== undefined) {
        consultationHistory.diagnostic = diagnostic;
      }
      if (medicalOrder !== undefined) {
        consultationHistory.medicalOrder = medicalOrder;
      }
      if (control !== undefined) {
        consultationHistory.control = control;
      }
      if (patientDocument !== undefined) {
        consultationHistory.patientDocument = patientDocument;
      }
      if (prescriptionIds !== undefined) {
        consultationHistory.prescriptionIds = prescriptionIds;
      }
      if (examOrderIds !== undefined) {
        consultationHistory.examOrderIds = examOrderIds;
      }
      if (referenceIds !== undefined) {
        consultationHistory.referenceIds = referenceIds;
      }
      consultationHistory.modifiedBy = user;
      consultationHistory.modifiedAt = new Date();

      const updated = await this.consultationHistoryRepository.update(consultationHistory);
      const event = new ConsultationHistoryUpdated(new Date(), updated, { user });
      publish(event);
      return updated;
    } else {
      // Create new
      consultationHistory = new ConsultationHistory();
      consultationHistory.patientHistoryId = patientHistoryId;
      consultationHistory.commerceId = commerceId;
      consultationHistory.clientId = clientId;
      consultationHistory.attentionId = attentionId;
      consultationHistory.bookingId = bookingId;
      consultationHistory.controlId = controlId;
      consultationHistory.originalAttentionId = originalAttentionId;
      consultationHistory.consultationReason = consultationReason || [];
      consultationHistory.currentIllness = currentIllness || [];
      consultationHistory.patientAnamnese = patientAnamnese || [];
      consultationHistory.functionalExam = functionalExam || [];
      consultationHistory.physicalExam = physicalExam || [];
      consultationHistory.diagnostic = diagnostic || [];
      consultationHistory.medicalOrder = medicalOrder || [];
      consultationHistory.control = control || [];
      consultationHistory.patientDocument = patientDocument || [];
      consultationHistory.prescriptionIds = prescriptionIds;
      consultationHistory.examOrderIds = examOrderIds;
      consultationHistory.referenceIds = referenceIds;
      consultationHistory.date = new Date();
      consultationHistory.createdBy = user;
      consultationHistory.createdAt = new Date();
      consultationHistory.modifiedBy = user;
      consultationHistory.modifiedAt = new Date();
      consultationHistory.active = true;
      consultationHistory.available = true;

      const created = await this.consultationHistoryRepository.create(consultationHistory);
      const event = new ConsultationHistoryCreated(new Date(), created, { user });
      publish(event);
      return created;
    }
  }

  /**
   * Get consultation history by attentionId
   */
  public async getConsultationHistoryByAttentionId(
    attentionId: string
  ): Promise<ConsultationHistory> {
    return await this.consultationHistoryRepository
      .whereEqualTo('attentionId', attentionId)
      .whereEqualTo('available', true)
      .findOne();
  }

  /**
   * Get all consultations for a patient
   */
  public async getConsultationsByPatientHistoryId(
    patientHistoryId: string
  ): Promise<ConsultationHistory[]> {
    const consultations = await this.consultationHistoryRepository
      .whereEqualTo('patientHistoryId', patientHistoryId)
      .whereEqualTo('available', true)
      .orderByDescending('date')
      .find();

    // Deduplicate by attentionId - keep only the most recent one for each attentionId
    const uniqueConsultations = new Map<string, ConsultationHistory>();
    for (const consultation of consultations) {
      if (consultation.attentionId) {
        const existing = uniqueConsultations.get(consultation.attentionId);
        if (
          !existing ||
          (consultation.date && existing.date && consultation.date > existing.date)
        ) {
          uniqueConsultations.set(consultation.attentionId, consultation);
        }
      } else {
        // If no attentionId, use id as key
        uniqueConsultations.set(consultation.id, consultation);
      }
    }

    return Array.from(uniqueConsultations.values()).sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }

  /**
   * Get all consultations for a client
   */
  public async getConsultationsByClientId(
    commerceId: string,
    clientId: string
  ): Promise<ConsultationHistory[]> {
    const consultations = await this.consultationHistoryRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .whereEqualTo('available', true)
      .orderByDescending('date')
      .find();

    // Deduplicate by attentionId - keep only the most recent one for each attentionId
    const uniqueConsultations = new Map<string, ConsultationHistory>();
    for (const consultation of consultations) {
      if (consultation.attentionId) {
        const existing = uniqueConsultations.get(consultation.attentionId);
        if (
          !existing ||
          (consultation.date && existing.date && consultation.date > existing.date)
        ) {
          uniqueConsultations.set(consultation.attentionId, consultation);
        }
      } else {
        // If no attentionId, use id as key
        uniqueConsultations.set(consultation.id, consultation);
      }
    }

    return Array.from(uniqueConsultations.values()).sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }

  /**
   * Link a prescription to a consultation
   */
  public async linkPrescriptionToConsultation(
    attentionId: string,
    prescriptionId: string,
    user?: string
  ): Promise<ConsultationHistory> {
    const consultation = await this.getConsultationHistoryByAttentionId(attentionId);
    if (consultation && consultation.id) {
      if (!consultation.prescriptionIds) {
        consultation.prescriptionIds = [];
      }
      if (!consultation.prescriptionIds.includes(prescriptionId)) {
        consultation.prescriptionIds.push(prescriptionId);
        consultation.modifiedAt = new Date();
        if (user) {
          consultation.modifiedBy = user;
        }
        const updated = await this.consultationHistoryRepository.update(consultation);
        const event = new ConsultationHistoryUpdated(new Date(), updated, {
          user: user || 'system',
        });
        publish(event);
        return updated;
      }
    }
    return consultation;
  }

  /**
   * Link an exam order to a consultation
   */
  public async linkExamOrderToConsultation(
    attentionId: string,
    examOrderId: string,
    user?: string
  ): Promise<ConsultationHistory> {
    const consultation = await this.getConsultationHistoryByAttentionId(attentionId);
    if (consultation && consultation.id) {
      if (!consultation.examOrderIds) {
        consultation.examOrderIds = [];
      }
      if (!consultation.examOrderIds.includes(examOrderId)) {
        consultation.examOrderIds.push(examOrderId);
        consultation.modifiedAt = new Date();
        if (user) {
          consultation.modifiedBy = user;
        }
        const updated = await this.consultationHistoryRepository.update(consultation);
        const event = new ConsultationHistoryUpdated(new Date(), updated, {
          user: user || 'system',
        });
        publish(event);
        return updated;
      }
    }
    return consultation;
  }

  /**
   * Link a medical reference to a consultation
   */
  public async linkReferenceToConsultation(
    attentionId: string,
    referenceId: string,
    user?: string
  ): Promise<ConsultationHistory> {
    const consultation = await this.getConsultationHistoryByAttentionId(attentionId);
    if (consultation && consultation.id) {
      if (!consultation.referenceIds) {
        consultation.referenceIds = [];
      }
      if (!consultation.referenceIds.includes(referenceId)) {
        consultation.referenceIds.push(referenceId);
        consultation.modifiedAt = new Date();
        if (user) {
          consultation.modifiedBy = user;
        }
        const updated = await this.consultationHistoryRepository.update(consultation);
        const event = new ConsultationHistoryUpdated(new Date(), updated, {
          user: user || 'system',
        });
        publish(event);
        return updated;
      }
    }
    return consultation;
  }
}
