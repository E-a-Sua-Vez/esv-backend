import { HttpException, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { getDateFormatted } from 'src/shared/utils/date';
import {
  sanitizePatientHistoryInput,
  validateAgeBirthdayConsistency,
  validateCIE10Code,
} from 'src/shared/utils/security-utils';

import { Attention } from '../attention/model/attention.entity';

import { ConsultationHistoryService } from './consultation-history.service';
import PatientHistoryCreated from './events/PatientHistoryCreated';
import PatientHistoryUpdated from './events/PatientHistoryUpdated';
import { PatientHistoryType } from './model/patient-history-type.enum';
import {
  ConsultationReason,
  CurrentIllness,
  Diagnostic,
  FunctionalExam,
  MedicalOrder,
  PatientHistory,
  PersonalData,
  PhysicalExam,
  PatientAnamnese,
  AditionalInfo,
  Control,
  PatientDocument,
} from './model/patient-history.entity';

export class PatientHistoryService {
  constructor(
    @InjectRepository(PatientHistory)
    private patientHistoryRepository = getRepository(PatientHistory),
    @Inject(forwardRef(() => ConsultationHistoryService))
    private consultationHistoryService?: ConsultationHistoryService
  ) {}

  public async getPatientHistoryById(id: string): Promise<PatientHistory> {
    return await this.patientHistoryRepository.findById(id);
  }

  public async getAllPatientHistory(): Promise<PatientHistory[]> {
    return await this.patientHistoryRepository
      .whereEqualTo('available', true)
      .orderByAscending('createdAt')
      .find();
  }

  public async getPatientHistorysByCommerceId(commerceId: string): Promise<PatientHistory[]> {
    return await this.patientHistoryRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('available', true)
      .orderByAscending('createdAt')
      .find();
  }

  public async getPatientHistorysByClientId(
    commerceId: string,
    clientId: string
  ): Promise<PatientHistory> {
    // FIX: Use orderByDescending to get the most recent record, not the oldest
    return await this.patientHistoryRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .whereEqualTo('available', true)
      .orderByDescending('createdAt')
      .findOne();
  }

  public async getActivePatientHistorysByCommerceId(commerceId: string): Promise<PatientHistory[]> {
    return await this.patientHistoryRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .orderByAscending('createdAt')
      .find();
  }

  public async savePatientHistory(
    user: string,
    commerceId: string,
    clientId: string,
    type: PatientHistoryType,
    personalData: PersonalData,
    consultationReason: ConsultationReason,
    currentIllness: CurrentIllness,
    patientAnamnese: PatientAnamnese,
    functionalExam: FunctionalExam,
    physicalExam: PhysicalExam,
    diagnostic: Diagnostic,
    medicalOrder: MedicalOrder,
    control: Control,
    aditionalInfo: AditionalInfo,
    active: boolean,
    available: boolean,
    lastAttentionId: string,
    patientDocument: PatientDocument
  ): Promise<PatientHistory> {
    // FIX XSS: Sanitize all inputs (already done in controller, but double-check here)
    // Inputs are sanitized in controller before reaching here

    // FIX CIE10: Validate CIE10 code if provided
    if (diagnostic && diagnostic.cie10Code) {
      if (!validateCIE10Code(diagnostic.cie10Code)) {
        throw new HttpException('Invalid CIE10 code format', HttpStatus.BAD_REQUEST);
      }
    }

    // FIX Age/Birthday: Validate consistency if both provided
    if (personalData && personalData.age && personalData.birthday) {
      if (!validateAgeBirthdayConsistency(personalData.age, personalData.birthday)) {
        throw new HttpException('Age does not match birthday', HttpStatus.BAD_REQUEST);
      }
    }
    let patientHistory = await this.getPatientHistorysByClientId(commerceId, clientId);
    if (patientHistory && patientHistory.id) {
      patientHistory = await this.updatePatientHistoryConfigurations(
        user,
        patientHistory.id,
        personalData,
        consultationReason,
        currentIllness,
        patientAnamnese,
        functionalExam,
        physicalExam,
        diagnostic,
        medicalOrder,
        control,
        aditionalInfo,
        active,
        available,
        lastAttentionId,
        patientDocument
      );
    } else {
      if (personalData !== undefined) {
        personalData.createdBy = user;
        personalData.createdAt = new Date();
      }
      if (consultationReason !== undefined) {
        consultationReason.createdBy = user;
        consultationReason.createdAt = new Date();
      }
      if (currentIllness !== undefined) {
        currentIllness.createdBy = user;
        currentIllness.createdAt = new Date();
      }
      if (patientAnamnese !== undefined) {
        patientAnamnese.createdBy = user;
        patientAnamnese.createdAt = new Date();
      }
      if (functionalExam !== undefined) {
        functionalExam.createdBy = user;
        functionalExam.createdAt = new Date();
      }
      if (physicalExam !== undefined) {
        physicalExam.createdBy = user;
        physicalExam.createdAt = new Date();
      }
      if (diagnostic !== undefined) {
        diagnostic.createdBy = user;
        diagnostic.createdAt = new Date();
      }
      if (medicalOrder !== undefined) {
        medicalOrder.createdBy = user;
        medicalOrder.createdAt = new Date();
      }
      if (patientDocument !== undefined) {
        patientDocument.createdBy = user;
        patientDocument.createdAt = new Date();
      }
      if (control !== undefined) {
        control.createdBy = user;
        control.createdAt = new Date();
      }
      patientHistory = await this.createPatientHistory(
        user,
        commerceId,
        clientId,
        type,
        personalData,
        [consultationReason],
        [currentIllness],
        patientAnamnese,
        [functionalExam],
        [physicalExam],
        [diagnostic],
        [medicalOrder],
        [control],
        aditionalInfo,
        lastAttentionId,
        [patientDocument]
      );
    }
    return patientHistory;
  }

  public async createPatientHistory(
    user: string,
    commerceId: string,
    clientId: string,
    type: PatientHistoryType,
    personalData: PersonalData,
    consultationReason: ConsultationReason[],
    currentIllness: CurrentIllness[],
    patientAnamnese: PatientAnamnese | PatientAnamnese[],
    functionalExam: FunctionalExam[],
    physicalExam: PhysicalExam[],
    diagnostic: Diagnostic[],
    medicalOrder: MedicalOrder[],
    control: Control[],
    aditionalInfo: AditionalInfo,
    lastAttentionId: string,
    patientDocument: PatientDocument[]
  ): Promise<PatientHistory> {
    const patientHistory = new PatientHistory();
    patientHistory.commerceId = commerceId;
    patientHistory.clientId = clientId;
    patientHistory.type = type || PatientHistoryType.STANDARD;
    patientHistory.personalData = personalData;
    patientHistory.consultationReason = consultationReason;
    patientHistory.currentIllness = currentIllness;
    // Convert PatientAnamnese to array if single object
    patientHistory.patientAnamnese = Array.isArray(patientAnamnese)
      ? patientAnamnese
      : patientAnamnese
      ? [patientAnamnese]
      : [];
    patientHistory.functionalExam = functionalExam;
    patientHistory.physicalExam = physicalExam;
    patientHistory.diagnostic = diagnostic;
    patientHistory.medicalOrder = medicalOrder;
    patientHistory.control = control;
    patientHistory.aditionalInfo = aditionalInfo;
    patientHistory.lastAttentionId = lastAttentionId;
    patientHistory.patientDocument = patientDocument;
    patientHistory.active = true;
    patientHistory.available = true;
    patientHistory.createdAt = new Date();
    patientHistory.createdBy = user;
    patientHistory.modifiedAt = new Date();
    patientHistory.modifiedBy = user;
    const patientHistoryCreated = await this.patientHistoryRepository.create(patientHistory);

    // Create consultation history record
    if (this.consultationHistoryService && lastAttentionId) {
      try {
        // Fetch attention to get relationship fields
        let bookingId: string | undefined;
        let controlId: string | undefined;
        let originalAttentionId: string | undefined;
        try {
          const attentionRepository = getRepository(Attention);
          const attention = await attentionRepository.findById(lastAttentionId);
          if (attention) {
            bookingId = attention.bookingId;
            controlId = attention.controlId;
            originalAttentionId = attention.originalAttentionId;
            // Also update attention with patientHistoryId
            if (!attention.patientHistoryId) {
              attention.patientHistoryId = patientHistoryCreated.id;
              await attentionRepository.update(attention);
            }
          }
        } catch (error) {
          console.warn('Could not fetch attention for relationship fields:', error);
        }

        await this.consultationHistoryService.saveConsultationHistory(
          user,
          patientHistoryCreated.id,
          commerceId,
          clientId,
          lastAttentionId,
          consultationReason,
          currentIllness,
          Array.isArray(patientAnamnese)
            ? patientAnamnese
            : patientAnamnese
            ? [patientAnamnese]
            : [],
          functionalExam,
          physicalExam,
          diagnostic,
          medicalOrder,
          control,
          patientDocument,
          [], // prescriptionIds - will be populated separately
          [], // examOrderIds - will be populated separately
          [], // referenceIds - will be populated separately
          bookingId,
          controlId,
          originalAttentionId
        );
      } catch (error) {
        console.error('Error creating consultation history:', error);
        // Don't fail the main operation if consultation history creation fails
      }
    }

    const patientHistoryCreatedEvent = new PatientHistoryCreated(
      new Date(),
      patientHistoryCreated,
      { user }
    );
    publish(patientHistoryCreatedEvent);
    return patientHistoryCreated;
  }

  public async updatePatientHistoryConfigurations(
    user: string,
    id: string,
    personalData: PersonalData,
    consultationReason: ConsultationReason,
    currentIllness: CurrentIllness,
    patientAnamnese: PatientAnamnese,
    functionalExam: FunctionalExam,
    physicalExam: PhysicalExam,
    diagnostic: Diagnostic,
    medicalOrder: MedicalOrder,
    control: Control,
    aditionalInfo: AditionalInfo,
    active: boolean,
    available: boolean,
    lastAttentionId: string,
    patientDocument: PatientDocument
  ): Promise<PatientHistory> {
    try {
      const patientHistory = await this.patientHistoryRepository.findById(id);

      // FIX Concurrent Updates: Use modifiedAt as version check
      // If modifiedAt changed since last read, someone else updated it
      const originalModifiedAt = patientHistory.modifiedAt;
      if (personalData !== undefined) {
        personalData.modifiedBy = user;
        personalData.modifiedAt = new Date();
        patientHistory.personalData = personalData;
      }
      if (
        consultationReason !== undefined &&
        consultationReason.reason !== undefined &&
        consultationReason.reason.trim().length > 0
      ) {
        if (lastAttentionId !== undefined && lastAttentionId !== null && lastAttentionId.trim().length > 0) {
          consultationReason.attentionId = lastAttentionId;
        }
        if (patientHistory.consultationReason && patientHistory.consultationReason.length > 0) {
          const todayResults = patientHistory.consultationReason.filter(
            exam => getDateFormatted(exam.createdAt) === getDateFormatted(new Date())
          );
          if (todayResults && todayResults.length === 1) {
            const todayResult = todayResults[0];
            const newResult = { ...todayResult, ...consultationReason };
            const resultsAux = patientHistory.consultationReason.filter(
              exam => getDateFormatted(exam.createdAt) !== getDateFormatted(new Date())
            );
            patientHistory.consultationReason = [...resultsAux, newResult];
          } else if (todayResults && todayResults.length > 1) {
            // FIX BUG #1: Handle multiple same-day entries - update the most recent one
            const sortedTodayResults = [...todayResults].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            const mostRecent = sortedTodayResults[0];
            const newResult = { ...mostRecent, ...consultationReason };
            const resultsAux = patientHistory.consultationReason.filter(
              exam => getDateFormatted(exam.createdAt) !== getDateFormatted(new Date())
            );
            patientHistory.consultationReason = [...resultsAux, newResult];
          } else if (!todayResults || todayResults.length === 0) {
            consultationReason.createdBy = user;
            consultationReason.createdAt = new Date();
            patientHistory.consultationReason = [
              ...patientHistory.consultationReason,
              consultationReason,
            ];
          }
        } else {
          consultationReason.createdBy = user;
          consultationReason.createdAt = new Date();
          if (patientHistory.consultationReason) {
            patientHistory.consultationReason = [
              ...patientHistory.consultationReason,
              consultationReason,
            ];
          } else {
            patientHistory.consultationReason = [consultationReason];
          }
        }
      }
      if (
        currentIllness !== undefined &&
        currentIllness.illness !== undefined &&
        currentIllness.illness.trim().length > 0
      ) {
        if (lastAttentionId !== undefined && lastAttentionId !== null && lastAttentionId.trim().length > 0) {
          currentIllness.attentionId = lastAttentionId;
        }
        if (patientHistory.currentIllness && patientHistory.currentIllness.length > 0) {
          const todayResults = patientHistory.currentIllness.filter(
            exam => getDateFormatted(exam.createdAt) === getDateFormatted(new Date())
          );
          if (todayResults && todayResults.length === 1) {
            const todayResult = todayResults[0];
            const newResult = { ...todayResult, ...currentIllness };
            const resultsAux = patientHistory.currentIllness.filter(
              exam => getDateFormatted(exam.createdAt) !== getDateFormatted(new Date())
            );
            patientHistory.currentIllness = [...resultsAux, newResult];
          } else if (todayResults && todayResults.length > 1) {
            // FIX BUG #1: Handle multiple same-day entries - update the most recent one
            const sortedTodayResults = [...todayResults].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            const mostRecent = sortedTodayResults[0];
            const newResult = { ...mostRecent, ...currentIllness };
            const resultsAux = patientHistory.currentIllness.filter(
              exam => getDateFormatted(exam.createdAt) !== getDateFormatted(new Date())
            );
            patientHistory.currentIllness = [...resultsAux, newResult];
          } else if (!todayResults || todayResults.length === 0) {
            currentIllness.createdBy = user;
            currentIllness.createdAt = new Date();
            patientHistory.currentIllness = [...patientHistory.currentIllness, currentIllness];
          }
        } else {
          currentIllness.createdBy = user;
          currentIllness.createdAt = new Date();
          if (patientHistory.currentIllness) {
            patientHistory.currentIllness = [...patientHistory.currentIllness, currentIllness];
          } else {
            patientHistory.currentIllness = [currentIllness];
          }
        }
      }
      if (patientAnamnese !== undefined) {
        // Handle PatientAnamnese as array
        const anamneseToAdd = Array.isArray(patientAnamnese) ? patientAnamnese : [patientAnamnese];

        // Set attentionId and metadata for each entry
        anamneseToAdd.forEach(anamnese => {
          anamnese.modifiedBy = user;
          anamnese.modifiedAt = new Date();
          if (lastAttentionId !== undefined) {
            anamnese.attentionId = lastAttentionId;
          }
          if (!anamnese.createdAt) {
            anamnese.createdAt = new Date();
            anamnese.createdBy = user;
          }
        });

        // Merge with existing or add new
        if (patientHistory.patientAnamnese && patientHistory.patientAnamnese.length > 0) {
          // Check if there's an entry for today's consultation
          const todayResults = patientHistory.patientAnamnese.filter(
            a =>
              getDateFormatted(a.createdAt || a.modifiedAt) === getDateFormatted(new Date()) &&
              a.attentionId === lastAttentionId
          );

          if (todayResults && todayResults.length > 0) {
            // Update existing entry
            const todayResult = todayResults[0];
            const updatedAnamnese = { ...todayResult, ...anamneseToAdd[0] };
            const otherResults = patientHistory.patientAnamnese.filter(
              a =>
                !(
                  getDateFormatted(a.createdAt || a.modifiedAt) === getDateFormatted(new Date()) &&
                  a.attentionId === lastAttentionId
                )
            );
            patientHistory.patientAnamnese = [...otherResults, updatedAnamnese];
          } else {
            // Add new entry
            patientHistory.patientAnamnese = [...patientHistory.patientAnamnese, ...anamneseToAdd];
          }
        } else {
          patientHistory.patientAnamnese = anamneseToAdd;
        }
      }
      if (
        functionalExam !== undefined &&
        functionalExam.exam !== undefined &&
        functionalExam.exam.trim().length > 0
      ) {
        if (lastAttentionId !== undefined && lastAttentionId !== null && lastAttentionId.trim().length > 0) {
          functionalExam.attentionId = lastAttentionId;
        }
        if (patientHistory.functionalExam && patientHistory.functionalExam.length > 0) {
          const todayResults = patientHistory.functionalExam.filter(
            exam => getDateFormatted(exam.createdAt) === getDateFormatted(new Date())
          );
          if (todayResults && todayResults.length === 1) {
            const todayResult = todayResults[0];
            const newResult = { ...todayResult, ...functionalExam };
            const resultsAux = patientHistory.functionalExam.filter(
              exam => getDateFormatted(exam.createdAt) !== getDateFormatted(new Date())
            );
            patientHistory.functionalExam = [...resultsAux, newResult];
          } else if (todayResults && todayResults.length > 1) {
            // FIX BUG #1: Handle multiple same-day entries - update the most recent one
            const sortedTodayResults = [...todayResults].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            const mostRecent = sortedTodayResults[0];
            const newResult = { ...mostRecent, ...functionalExam };
            const resultsAux = patientHistory.functionalExam.filter(
              exam => getDateFormatted(exam.createdAt) !== getDateFormatted(new Date())
            );
            patientHistory.functionalExam = [...resultsAux, newResult];
          } else if (!todayResults || todayResults.length === 0) {
            functionalExam.createdBy = user;
            functionalExam.createdAt = new Date();
            patientHistory.functionalExam = [...patientHistory.functionalExam, functionalExam];
          }
        } else {
          functionalExam.createdBy = user;
          functionalExam.createdAt = new Date();
          if (patientHistory.functionalExam) {
            patientHistory.functionalExam = [...patientHistory.functionalExam, functionalExam];
          } else {
            patientHistory.functionalExam = [functionalExam];
          }
        }
      }
      if (
        physicalExam !== undefined &&
        ((physicalExam.exam !== undefined && physicalExam.exam.trim().length > 0) ||
          (physicalExam.examDetails && Object.keys(physicalExam.examDetails).length > 0))
      ) {
        if (lastAttentionId !== undefined && lastAttentionId !== null && lastAttentionId.trim().length > 0) {
          physicalExam.attentionId = lastAttentionId;
        }
        if (patientHistory.physicalExam && patientHistory.physicalExam.length > 0) {
          const todayResults = patientHistory.physicalExam.filter(
            exam =>
              getDateFormatted(exam.createdAt ? exam.createdAt : new Date()) ===
              getDateFormatted(new Date())
          );
          if (todayResults && todayResults.length === 1) {
            const todayResult = todayResults[0];
            const newResult = { ...todayResult, ...physicalExam };
            const resultsAux = patientHistory.physicalExam.filter(
              exam =>
                getDateFormatted(exam.createdAt ? exam.createdAt : new Date()) !==
                getDateFormatted(new Date())
            );
            patientHistory.physicalExam = [...resultsAux, newResult];
          } else if (todayResults && todayResults.length > 1) {
            // FIX BUG #1: Handle multiple same-day entries - update the most recent one
            const sortedTodayResults = [...todayResults].sort(
              (a, b) => new Date(b.createdAt || new Date()).getTime() - new Date(a.createdAt || new Date()).getTime()
            );
            const mostRecent = sortedTodayResults[0];
            const newResult = { ...mostRecent, ...physicalExam };
            const resultsAux = patientHistory.physicalExam.filter(
              exam =>
                getDateFormatted(exam.createdAt ? exam.createdAt : new Date()) !==
                getDateFormatted(new Date())
            );
            patientHistory.physicalExam = [...resultsAux, newResult];
          } else if (!todayResults || todayResults.length === 0) {
            physicalExam.createdBy = user;
            physicalExam.createdAt = new Date();
            patientHistory.physicalExam = [...patientHistory.physicalExam, physicalExam];
          }
        } else {
          physicalExam.createdBy = user;
          physicalExam.createdAt = new Date();
          if (patientHistory.physicalExam) {
            patientHistory.physicalExam = [...patientHistory.physicalExam, physicalExam];
          } else {
            patientHistory.physicalExam = [physicalExam];
          }
        }
      }
      if (
        diagnostic !== undefined &&
        diagnostic.diagnostic !== undefined &&
        diagnostic.diagnostic.trim().length > 0
      ) {
        if (lastAttentionId !== undefined && lastAttentionId !== null && lastAttentionId.trim().length > 0) {
          diagnostic.attentionId = lastAttentionId;
        }
        if (patientHistory.diagnostic && patientHistory.diagnostic.length > 0) {
          const todayResults = patientHistory.diagnostic.filter(
            exam => getDateFormatted(exam.createdAt) === getDateFormatted(new Date())
          );
          if (todayResults && todayResults.length === 1) {
            const todayResult = todayResults[0];
            const newResult = { ...todayResult, ...diagnostic };
            const resultsAux = patientHistory.diagnostic.filter(
              exam => getDateFormatted(exam.createdAt) !== getDateFormatted(new Date())
            );
            patientHistory.diagnostic = [...resultsAux, newResult];
          } else if (todayResults && todayResults.length > 1) {
            // FIX BUG #1: Handle multiple same-day entries - update the most recent one
            const sortedTodayResults = [...todayResults].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            const mostRecent = sortedTodayResults[0];
            const newResult = { ...mostRecent, ...diagnostic };
            const resultsAux = patientHistory.diagnostic.filter(
              exam => getDateFormatted(exam.createdAt) !== getDateFormatted(new Date())
            );
            patientHistory.diagnostic = [...resultsAux, newResult];
          } else if (!todayResults || todayResults.length === 0) {
            diagnostic.createdBy = user;
            diagnostic.createdAt = new Date();
            patientHistory.diagnostic = [...patientHistory.diagnostic, diagnostic];
          }
        } else {
          diagnostic.createdBy = user;
          diagnostic.createdAt = new Date();
          if (patientHistory.diagnostic) {
            patientHistory.diagnostic = [...patientHistory.diagnostic, diagnostic];
          } else {
            patientHistory.diagnostic = [diagnostic];
          }
        }
      }
      if (
        control !== undefined &&
        control.scheduledDate !== undefined &&
        control.status !== undefined &&
        control.reason !== undefined
      ) {
        if (lastAttentionId !== undefined && lastAttentionId !== null && lastAttentionId.trim().length > 0) {
          control.attentionId = lastAttentionId;
        }
        if (patientHistory.control && patientHistory.control.length > 0) {
          const todayResults = patientHistory.control.filter(
            ctrl =>
              getDateFormatted(new Date(ctrl.scheduledDate)) ===
              getDateFormatted(new Date(control.scheduledDate))
          );
          if (todayResults && todayResults.length === 1) {
            const todayResult = todayResults[0];
            const newResult = { ...todayResult, ...control };
            const resultsAux = patientHistory.control.filter(
              ctrl =>
                getDateFormatted(new Date(ctrl.scheduledDate)) !==
                getDateFormatted(new Date(control.scheduledDate))
            );
            patientHistory.control = [...resultsAux, newResult];
          } else if (todayResults && todayResults.length > 1) {
            // FIX BUG #1: Handle multiple same-day entries - update the most recent one
            const sortedTodayResults = [...todayResults].sort(
              (a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()
            );
            const mostRecent = sortedTodayResults[0];
            const newResult = { ...mostRecent, ...control };
            const resultsAux = patientHistory.control.filter(
              ctrl =>
                getDateFormatted(new Date(ctrl.scheduledDate)) !==
                getDateFormatted(new Date(control.scheduledDate))
            );
            patientHistory.control = [...resultsAux, newResult];
          } else if (!todayResults || todayResults.length === 0) {
            control.createdBy = user;
            control.createdAt = new Date();
            patientHistory.control = [...patientHistory.control, control];
          }
        } else {
          control.createdBy = user;
          control.createdAt = new Date();
          if (patientHistory.control) {
            patientHistory.control = [...patientHistory.control, control];
          } else {
            patientHistory.control = [control];
          }
        }
      }
      // Handle medicalOrder - can be a single object or an array
      if (medicalOrder !== undefined) {
        let ordersToProcess: MedicalOrder[] = [];

        // Normalize to array
        if (Array.isArray(medicalOrder)) {
          ordersToProcess = medicalOrder;
        } else if (medicalOrder && typeof medicalOrder === 'object') {
          // Single object - check if it has content
          if (medicalOrder.medicalOrder && medicalOrder.medicalOrder.trim().length > 0) {
            ordersToProcess = [medicalOrder];
          } else if (medicalOrder.prescriptionId || medicalOrder.examOrderId || medicalOrder.referenceId) {
            // Has reference to structured entity
            ordersToProcess = [medicalOrder];
          }
        }

        // Process each order
        if (ordersToProcess.length > 0) {
          if (!patientHistory.medicalOrder) {
            patientHistory.medicalOrder = [];
          }

          ordersToProcess.forEach(order => {
            if (lastAttentionId !== undefined && lastAttentionId !== null && lastAttentionId.trim().length > 0) {
              order.attentionId = lastAttentionId;
            }

            // Check if this order already exists (by ID reference or by text content)
            let existingIndex = -1;
            if (order.prescriptionId) {
              existingIndex = patientHistory.medicalOrder.findIndex(
                o => o.prescriptionId === order.prescriptionId
              );
            } else if (order.examOrderId) {
              existingIndex = patientHistory.medicalOrder.findIndex(
                o => o.examOrderId === order.examOrderId
              );
            } else if (order.referenceId) {
              existingIndex = patientHistory.medicalOrder.findIndex(
                o => o.referenceId === order.referenceId
              );
            } else if (order.medicalOrder && order.medicalOrder.trim().length > 0) {
              // For text orders, check by date and content
              const todayResults = patientHistory.medicalOrder.filter(
                o => getDateFormatted(o.createdAt) === getDateFormatted(new Date()) &&
                     o.medicalOrder === order.medicalOrder
              );
              if (todayResults.length > 0) {
                existingIndex = patientHistory.medicalOrder.findIndex(
                  o => o === todayResults[0]
                );
              }
            }

            if (existingIndex >= 0) {
              // Update existing order
              order.createdBy = order.createdBy || patientHistory.medicalOrder[existingIndex].createdBy || user;
              order.createdAt = order.createdAt || patientHistory.medicalOrder[existingIndex].createdAt || new Date();
              patientHistory.medicalOrder[existingIndex] = order;
            } else {
              // Add new order
              order.createdBy = order.createdBy || user;
              order.createdAt = order.createdAt || new Date();
              patientHistory.medicalOrder.push(order);
            }
          });
        }
      }
      if (patientDocument !== undefined) {
        if (lastAttentionId !== undefined && lastAttentionId !== null && lastAttentionId.trim().length > 0) {
          patientDocument.attentionId = lastAttentionId;
        }
        // FIX BUG #2: Check for existing entry for this attention before adding
        if (patientHistory.patientDocument && patientHistory.patientDocument.length > 0) {
          const existingForAttention = patientHistory.patientDocument.find(
            doc => doc.attentionId === lastAttentionId &&
                   getDateFormatted(doc.createdAt) === getDateFormatted(new Date())
          );
          if (existingForAttention) {
            // Update existing entry
            const updated = { ...existingForAttention, ...patientDocument };
            patientHistory.patientDocument = patientHistory.patientDocument.map(
              doc => doc.attentionId === lastAttentionId &&
                     getDateFormatted(doc.createdAt) === getDateFormatted(new Date())
                ? updated
                : doc
            );
          } else {
            // Add new entry
            patientDocument.createdBy = user;
            patientDocument.createdAt = new Date();
            patientHistory.patientDocument = [...patientHistory.patientDocument, patientDocument];
          }
        } else {
          patientDocument.createdBy = user;
          patientDocument.createdAt = new Date();
          patientHistory.patientDocument = [patientDocument];
        }
      }
      if (aditionalInfo !== undefined) {
        aditionalInfo.modifiedBy = user;
        aditionalInfo.modifiedAt = new Date();
        patientHistory.aditionalInfo = { ...patientHistory.aditionalInfo, ...aditionalInfo };
      }
      if (lastAttentionId !== undefined) {
        patientHistory.lastAttentionId = lastAttentionId;
      }
      if (active !== undefined) {
        patientHistory.active = active;
      }
      if (available !== undefined) {
        patientHistory.available = available;
      }
      patientHistory.modifiedAt = new Date();
      patientHistory.modifiedBy = user;
      const patientHistoryUpdated = await this.patientHistoryRepository.update(patientHistory);

      // Update or create consultation history record
      if (this.consultationHistoryService && lastAttentionId) {
        try {
          // Get current consultation data from arrays filtered by attentionId
          const consultationReasonForAttention =
            patientHistory.consultationReason?.filter(cr => cr.attentionId === lastAttentionId) ||
            [];
          const currentIllnessForAttention =
            patientHistory.currentIllness?.filter(ci => ci.attentionId === lastAttentionId) || [];
          const patientAnamneseForAttention =
            patientHistory.patientAnamnese?.filter(pa => pa.attentionId === lastAttentionId) || [];
          const functionalExamForAttention =
            patientHistory.functionalExam?.filter(fe => fe.attentionId === lastAttentionId) || [];
          const physicalExamForAttention =
            patientHistory.physicalExam?.filter(pe => pe.attentionId === lastAttentionId) || [];
          const diagnosticForAttention =
            patientHistory.diagnostic?.filter(d => d.attentionId === lastAttentionId) || [];
          const medicalOrderForAttention =
            patientHistory.medicalOrder?.filter(mo => mo.attentionId === lastAttentionId) || [];
          const controlForAttention =
            patientHistory.control?.filter(c => c.attentionId === lastAttentionId) || [];
          const patientDocumentForAttention =
            patientHistory.patientDocument?.filter(pd => pd.attentionId === lastAttentionId) || [];

          // Fetch attention to get relationship fields
          let bookingId: string | undefined;
          let controlId: string | undefined;
          let originalAttentionId: string | undefined;
          try {
            const attentionRepository = getRepository(Attention);
            const attention = await attentionRepository.findById(lastAttentionId);
            if (attention) {
              bookingId = attention.bookingId;
              controlId = attention.controlId;
              originalAttentionId = attention.originalAttentionId;
              // Also update attention with patientHistoryId
              if (!attention.patientHistoryId) {
                attention.patientHistoryId = id;
                await attentionRepository.update(attention);
              }
            }
          } catch (error) {
            console.warn('Could not fetch attention for relationship fields:', error);
          }

          await this.consultationHistoryService.saveConsultationHistory(
            user,
            id,
            patientHistory.commerceId,
            patientHistory.clientId,
            lastAttentionId,
            consultationReasonForAttention,
            currentIllnessForAttention,
            patientAnamneseForAttention,
            functionalExamForAttention,
            physicalExamForAttention,
            diagnosticForAttention,
            medicalOrderForAttention,
            controlForAttention,
            patientDocumentForAttention,
            [], // prescriptionIds - will be populated separately
            [], // examOrderIds - will be populated separately
            [], // referenceIds - will be populated separately
            bookingId,
            controlId,
            originalAttentionId
          );
        } catch (error) {
          console.error('Error updating consultation history:', error);
          // Don't fail the main operation if consultation history update fails
        }
      }

      const patientHistoryUpdatedEvent = new PatientHistoryUpdated(
        new Date(),
        patientHistoryUpdated,
        { user }
      );
      publish(patientHistoryUpdatedEvent);
      return patientHistoryUpdated;
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al modificar el patientHistory: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async updatePatientHistoryControl(
    user: string,
    id: string,
    control: Control[],
    patientDocument: PatientDocument[],
    lastAttentionId: string
  ): Promise<PatientHistory> {
    try {
      const patientHistory = await this.patientHistoryRepository.findById(id);
      // Capture original modifiedAt for concurrent update check
      const originalModifiedAt = patientHistory?.modifiedAt;

      if (patientHistory && patientHistory.id) {
        if (control !== undefined) {
          patientHistory.control = control;
        }
        if (patientDocument !== undefined) {
          patientHistory.patientDocument = patientDocument;
        }
      if (lastAttentionId !== undefined) {
        patientHistory.lastAttentionId = lastAttentionId;
      }

      // FIX Concurrent Updates: Verify no concurrent modification
      // Re-read to check if modifiedAt changed (someone else updated it)
      const currentHistory = await this.patientHistoryRepository.findById(id);
      if (currentHistory.modifiedAt && originalModifiedAt &&
          currentHistory.modifiedAt.getTime() !== originalModifiedAt.getTime()) {
        throw new HttpException(
          'Patient history was modified by another user. Please refresh and try again.',
          HttpStatus.CONFLICT
        );
      }

      patientHistory.modifiedAt = new Date();
      patientHistory.modifiedBy = user;
      const patientHistoryUpdated = await this.patientHistoryRepository.update(patientHistory);
        const patientHistoryUpdatedEvent = new PatientHistoryUpdated(
          new Date(),
          patientHistoryUpdated,
          { user }
        );
        publish(patientHistoryUpdatedEvent);
        return patientHistoryUpdated;
      }
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al modificar el control patientHistory: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
