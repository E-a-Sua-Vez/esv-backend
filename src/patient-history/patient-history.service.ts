import { ConsultationReason, CurrentIllness, Diagnostic, FamilyBackground, FunctionalExam, MedicalOrder, PatientHistory, PersonalBackground, PersonalData, PhysicalExam, PsychobiologicalHabits, AditionalInfo } from './model/patient-history.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';
import PatientHistoryCreated from './events/PatientHistoryCreated';
import PatientHistoryUpdated from './events/PatientHistoryUpdated';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PatientHistoryType } from './model/patient-history-type.enum';
import { getDateFormatted } from 'src/shared/utils/date';

export class PatientHistoryService {
  constructor(
    @InjectRepository(PatientHistory)
    private patientHistoryRepository = getRepository(PatientHistory)
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

  public async getPatientHistorysByClientId(commerceId: string, clientId: string): Promise<PatientHistory> {
    return await this.patientHistoryRepository
    .whereEqualTo('commerceId', commerceId)
    .whereEqualTo('clientId', clientId)
    .whereEqualTo('available', true)
    .orderByAscending('createdAt')
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

  public async savePatientHistory(user: string, commerceId: string, clientId: string, type: PatientHistoryType, personalData: PersonalData,
    consultationReason: ConsultationReason, currentIllness: CurrentIllness, personalBackground: PersonalBackground,
    familyBackground: FamilyBackground, psychobiologicalHabits: PsychobiologicalHabits, functionalExam: FunctionalExam,
    physicalExam: PhysicalExam, diagnostic: Diagnostic, medicalOrder: MedicalOrder, aditionalInfo: AditionalInfo, active: boolean, available: boolean, lastAttentionId: string): Promise<PatientHistory> {
    let patientHistory = await this.getPatientHistorysByClientId(commerceId, clientId);
    if (patientHistory && patientHistory.id) {
      patientHistory = await this.updatePatientHistoryConfigurations(user, patientHistory.id, personalData, consultationReason,
        currentIllness, personalBackground, familyBackground, psychobiologicalHabits,
        functionalExam, physicalExam, diagnostic, medicalOrder, aditionalInfo, active, available, lastAttentionId)
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
      if (personalBackground !== undefined) {
        personalBackground.createdBy = user;
        personalBackground.createdAt = new Date();
      }
      if (familyBackground !== undefined) {
        familyBackground.createdBy = user;
        familyBackground.createdAt = new Date();
      }
      if (psychobiologicalHabits !== undefined) {
        psychobiologicalHabits.createdBy = user;
        psychobiologicalHabits.createdAt = new Date();
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
      patientHistory = await this.createPatientHistory(user, commerceId, clientId, type, personalData, [consultationReason], [currentIllness], [personalBackground],
        [familyBackground], psychobiologicalHabits, [functionalExam], [physicalExam], [diagnostic], [medicalOrder], aditionalInfo, lastAttentionId);
    }
    return patientHistory;
  }

  public async createPatientHistory(user: string, commerceId: string, clientId: string, type: PatientHistoryType, personalData: PersonalData,
    consultationReason: ConsultationReason[], currentIllness: CurrentIllness[], personalBackground: PersonalBackground[],
    familyBackground: FamilyBackground[], psychobiologicalHabits : PsychobiologicalHabits, functionalExam: FunctionalExam[],
    physicalExam: PhysicalExam[], diagnostic: Diagnostic[], medicalOrder: MedicalOrder[], aditionalInfo: AditionalInfo, lastAttentionId: string): Promise<PatientHistory> {
    let patientHistory = new PatientHistory();
    patientHistory.commerceId = commerceId;
    patientHistory.clientId = clientId;
    patientHistory.type = type || PatientHistoryType.STANDARD;
    patientHistory.personalData = personalData;
    patientHistory.consultationReason = consultationReason;
    patientHistory.currentIllness = currentIllness;
    patientHistory.personalBackground = personalBackground;
    patientHistory.familyBackground = familyBackground;
    patientHistory.psychobiologicalHabits = psychobiologicalHabits;
    patientHistory.functionalExam = functionalExam;
    patientHistory.physicalExam = physicalExam;
    patientHistory.diagnostic = diagnostic;
    patientHistory.medicalOrder = medicalOrder;
    patientHistory.aditionalInfo = aditionalInfo;
    patientHistory.lastAttentionId = lastAttentionId;
    patientHistory.active = true;
    patientHistory.available = true;
    patientHistory.createdAt = new Date();
    patientHistory.createdBy = user;
    const patientHistoryCreated = await this.patientHistoryRepository.create(patientHistory);
    const patientHistoryCreatedEvent = new PatientHistoryCreated(new Date(), patientHistoryCreated, { user });
    publish(patientHistoryCreatedEvent);
    return patientHistoryCreated;
  }

  public async updatePatientHistoryConfigurations(user: string, id: string, personalData: PersonalData,
    consultationReason: ConsultationReason, currentIllness: CurrentIllness, personalBackground: PersonalBackground,
    familyBackground: FamilyBackground, psychobiologicalHabits: PsychobiologicalHabits, functionalExam: FunctionalExam,
    physicalExam: PhysicalExam, diagnostic: Diagnostic, medicalOrder: MedicalOrder, aditionalInfo: AditionalInfo,
    active: boolean, available: boolean, lastAttentionId: string): Promise<PatientHistory> {
    try {
      let patientHistory = await this.patientHistoryRepository.findById(id);
      if (personalData !== undefined) {
        personalData.modifiedBy = user;
        personalData.modifiedAt = new Date();
        patientHistory.personalData = personalData;
      }
      if (consultationReason !== undefined) {
        if (lastAttentionId !== undefined) {
          consultationReason.attentionId = lastAttentionId;
        }
        if (patientHistory.consultationReason && patientHistory.consultationReason.length > 0) {
          const todayResults = patientHistory.consultationReason.filter(exam => getDateFormatted(exam.createdAt) === getDateFormatted(new Date()));
          if (todayResults && todayResults.length === 1) {
            const todayResult = todayResults[0];
            const newResult = { ...todayResult, ...consultationReason };
            const resultsAux = patientHistory.consultationReason.filter(exam => getDateFormatted(exam.createdAt) !== getDateFormatted(new Date()));
            patientHistory.consultationReason = [...resultsAux, newResult];
          } else if (!todayResults || todayResults.length === 0) {
            consultationReason.createdBy = user;
            consultationReason.createdAt = new Date();
            patientHistory.consultationReason = [...patientHistory.consultationReason, consultationReason];
          }
        } else {
          consultationReason.createdBy = user;
          consultationReason.createdAt = new Date();
          patientHistory.consultationReason = [...patientHistory.consultationReason, consultationReason];
        }
      }
      if (currentIllness !== undefined) {
        if (lastAttentionId !== undefined) {
          currentIllness.attentionId = lastAttentionId;
        }
        if (patientHistory.currentIllness && patientHistory.currentIllness.length > 0) {
          const todayResults = patientHistory.currentIllness.filter(exam => getDateFormatted(exam.createdAt) === getDateFormatted(new Date()));
          if (todayResults && todayResults.length === 1) {
            const todayResult = todayResults[0];
            const newResult = { ...todayResult, ...currentIllness };
            const resultsAux = patientHistory.currentIllness.filter(exam => getDateFormatted(exam.createdAt) !== getDateFormatted(new Date()));
            patientHistory.currentIllness = [...resultsAux, newResult];
          } else if (!todayResults || todayResults.length === 0) {
            currentIllness.createdBy = user;
            currentIllness.createdAt = new Date();
            patientHistory.currentIllness = [...patientHistory.currentIllness, currentIllness];
          }
        } else {
          currentIllness.createdBy = user;
          currentIllness.createdAt = new Date();
          patientHistory.currentIllness = [...patientHistory.currentIllness, currentIllness];
        }
      }
      if (personalBackground !== undefined) {
        if (lastAttentionId !== undefined) {
          personalBackground.attentionId = lastAttentionId;
        }
        if (patientHistory.personalBackground && patientHistory.personalBackground.length > 0) {
          const todayResults = patientHistory.personalBackground.filter(exam => getDateFormatted(exam.createdAt) === getDateFormatted(new Date()));
          if (todayResults && todayResults.length === 1) {
            const todayResult = todayResults[0];
            const newResult = { ...todayResult, ...personalBackground };
            const resultsAux = patientHistory.personalBackground.filter(exam => getDateFormatted(exam.createdAt) !== getDateFormatted(new Date()));
            patientHistory.personalBackground = [...resultsAux, newResult];
          } else if (!todayResults || todayResults.length === 0) {
            personalBackground.createdBy = user;
            personalBackground.createdAt = new Date();
            patientHistory.personalBackground = [...patientHistory.personalBackground, personalBackground];
          }
        } else {
          personalBackground.createdBy = user;
          personalBackground.createdAt = new Date();
          patientHistory.personalBackground = [...patientHistory.personalBackground, personalBackground];
        }
      }
      if (familyBackground !== undefined) {
        if (lastAttentionId !== undefined) {
          familyBackground.attentionId = lastAttentionId;
        }
        if (patientHistory.familyBackground && patientHistory.familyBackground.length > 0) {
          const todayResults = patientHistory.familyBackground.filter(exam => getDateFormatted(exam.createdAt) === getDateFormatted(new Date()));
          if (todayResults && todayResults.length === 1) {
            const todayResult = todayResults[0];
            const newResult = { ...todayResult, ...familyBackground };
            const resultsAux = patientHistory.familyBackground.filter(exam => getDateFormatted(exam.createdAt) !== getDateFormatted(new Date()));
            patientHistory.familyBackground = [...resultsAux, newResult];
          } else if (!todayResults || todayResults.length === 0) {
            familyBackground.createdBy = user;
            familyBackground.createdAt = new Date();
            patientHistory.familyBackground = [...patientHistory.familyBackground, familyBackground];
          }
        } else {
          familyBackground.createdBy = user;
          familyBackground.createdAt = new Date();
          patientHistory.familyBackground = [...patientHistory.familyBackground, familyBackground];
        }
      }
      if (psychobiologicalHabits !== undefined) {
        psychobiologicalHabits.modifiedBy = user;
        psychobiologicalHabits.modifiedAt = new Date();
        if (lastAttentionId !== undefined) {
          psychobiologicalHabits.attentionId = lastAttentionId;
        }
        patientHistory.psychobiologicalHabits = { ...patientHistory.psychobiologicalHabits, ...psychobiologicalHabits };
      }
      if (functionalExam !== undefined) {
        if (lastAttentionId !== undefined) {
          functionalExam.attentionId = lastAttentionId;
        }
        if (patientHistory.functionalExam && patientHistory.functionalExam.length > 0) {
          const todayResults = patientHistory.functionalExam.filter(exam => getDateFormatted(exam.createdAt) === getDateFormatted(new Date()));
          if (todayResults && todayResults.length === 1) {
            const todayResult = todayResults[0];
            const newResult = { ...todayResult, ...functionalExam };
            const resultsAux = patientHistory.functionalExam.filter(exam => getDateFormatted(exam.createdAt) !== getDateFormatted(new Date()));
            patientHistory.functionalExam = [...resultsAux, newResult];
          } else if (!todayResults || todayResults.length === 0) {
            functionalExam.createdBy = user;
            functionalExam.createdAt = new Date();
            patientHistory.functionalExam = [...patientHistory.functionalExam, functionalExam];
          }
        } else {
          functionalExam.createdBy = user;
          functionalExam.createdAt = new Date();
          patientHistory.functionalExam = [...patientHistory.functionalExam, functionalExam];
        }
      }
      if (physicalExam !== undefined) {
        if (lastAttentionId !== undefined) {
          physicalExam.attentionId = lastAttentionId;
        }
        if (patientHistory.physicalExam && patientHistory.physicalExam.length > 0) {
          const todayResults = patientHistory.physicalExam.filter(exam => getDateFormatted(exam.createdAt) === getDateFormatted(new Date()));
          if (todayResults && todayResults.length === 1) {
            const todayResult = todayResults[0];
            const newResult = { ...todayResult, ...physicalExam };
            const resultsAux = patientHistory.physicalExam.filter(exam => getDateFormatted(exam.createdAt) !== getDateFormatted(new Date()));
            patientHistory.physicalExam = [...resultsAux, newResult];
          } else if (!todayResults || todayResults.length === 0) {
            physicalExam.createdBy = user;
            physicalExam.createdAt = new Date();
            patientHistory.functionalExam = [...patientHistory.functionalExam, functionalExam];
          }
        } else {
          physicalExam.createdBy = user;
          physicalExam.createdAt = new Date();
          patientHistory.physicalExam = [...patientHistory.physicalExam, physicalExam];
        }
      }
      if (diagnostic !== undefined) {
        if (lastAttentionId !== undefined) {
          diagnostic.attentionId = lastAttentionId;
        }
        if (patientHistory.diagnostic && patientHistory.diagnostic.length > 0) {
          const todayResults = patientHistory.diagnostic.filter(exam => getDateFormatted(exam.createdAt) === getDateFormatted(new Date()));
          if (todayResults && todayResults.length === 1) {
            const todayResult = todayResults[0];
            const newResult = { ...todayResult, ...diagnostic };
            const resultsAux = patientHistory.diagnostic.filter(exam => getDateFormatted(exam.createdAt) !== getDateFormatted(new Date()));
            patientHistory.diagnostic = [...resultsAux, newResult];
          } else if (!todayResults || todayResults.length === 0) {
            diagnostic.createdBy = user;
            diagnostic.createdAt = new Date();
            patientHistory.diagnostic = [...patientHistory.diagnostic, diagnostic];
          }
        } else {
          diagnostic.createdBy = user;
          diagnostic.createdAt = new Date();
          patientHistory.diagnostic = [...patientHistory.diagnostic, diagnostic];
        }
      }
      if (medicalOrder !== undefined) {
        if (lastAttentionId !== undefined) {
          medicalOrder.attentionId = lastAttentionId;
        }
        if (patientHistory.medicalOrder && patientHistory.medicalOrder.length > 0) {
          const todayResults = patientHistory.medicalOrder.filter(exam => getDateFormatted(exam.createdAt) === getDateFormatted(new Date()));
          if (todayResults && todayResults.length === 1) {
            const todayResult = todayResults[0];
            const newResult = { ...todayResult, ...medicalOrder };
            const resultsAux = patientHistory.medicalOrder.filter(exam => getDateFormatted(exam.createdAt) !== getDateFormatted(new Date()));
            patientHistory.medicalOrder = [...resultsAux, newResult];
          } else if (!todayResults || todayResults.length === 0) {
            medicalOrder.createdBy = user;
            medicalOrder.createdAt = new Date();
            patientHistory.medicalOrder = [...patientHistory.medicalOrder, medicalOrder];
          }
        } else {
          medicalOrder.createdBy = user;
          medicalOrder.createdAt = new Date();
          patientHistory.medicalOrder = [...patientHistory.medicalOrder, medicalOrder];
        }
      }
      if (aditionalInfo !== undefined) {
        aditionalInfo.modifiedBy = user;
        aditionalInfo.modifiedAt = new Date();
        patientHistory.aditionalInfo = {...patientHistory.aditionalInfo, ...aditionalInfo};
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
      const patientHistoryUpdatedEvent = new PatientHistoryUpdated(new Date(), patientHistoryUpdated, { user });
      publish(patientHistoryUpdatedEvent);
      return patientHistoryUpdated;
    } catch (error) {
      throw new HttpException(`Hubo un problema al modificar el patientHistory: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
