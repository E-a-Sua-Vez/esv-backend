import { ConsultationReason, CurrentIllness, Diagnostic, FamilyBackground, FunctionalExam, MedicalOrder, PatientHistory, PersonalBackground, PersonalData, PhysicalExam, PsychobiologicalHabits, AditionalInfo } from './model/patient-history.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';
import PatientHistoryCreated from './events/PatientHistoryCreated';
import PatientHistoryUpdated from './events/PatientHistoryUpdated';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PatientHistoryType } from './model/patient-history-type.enum';

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
      patientHistory = await this.createPatientHistory(user, commerceId, clientId, type, personalData, [consultationReason], [currentIllness], [personalBackground],
        [familyBackground], [psychobiologicalHabits], [functionalExam], [physicalExam], [diagnostic], [medicalOrder], aditionalInfo, lastAttentionId);
    }
    return patientHistory;
  }

  public async createPatientHistory(user: string, commerceId: string, clientId: string, type: PatientHistoryType, personalData: PersonalData,
    consultationReason: ConsultationReason[], currentIllness: CurrentIllness[], personalBackground: PersonalBackground[],
    familyBackground: FamilyBackground[], psychobiologicalHabits : PsychobiologicalHabits[], functionalExam: FunctionalExam[],
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
        consultationReason.createdBy = user;
        consultationReason.createdAt = new Date();
        if (lastAttentionId !== undefined) {
          consultationReason.attentionId = lastAttentionId;
        }
        patientHistory.consultationReason = [...patientHistory.consultationReason, consultationReason];
      }
      if (currentIllness !== undefined) {
        currentIllness.createdBy = user;
        currentIllness.createdAt = new Date();
        if (lastAttentionId !== undefined) {
          currentIllness.attentionId = lastAttentionId;
        }
        patientHistory.currentIllness = [...patientHistory.currentIllness, currentIllness];
      }
      if (personalBackground !== undefined) {
        personalBackground.createdBy = user;
        personalBackground.createdAt = new Date();
        if (lastAttentionId !== undefined) {
          personalBackground.attentionId = lastAttentionId;
        }
        patientHistory.personalBackground = [...patientHistory.personalBackground, personalBackground];
      }
      if (familyBackground !== undefined) {
        familyBackground.createdBy = user;
        familyBackground.createdAt = new Date();
        if (lastAttentionId !== undefined) {
          familyBackground.attentionId = lastAttentionId;
        }
        patientHistory.familyBackground = [...patientHistory.familyBackground, familyBackground];
      }
      if (psychobiologicalHabits !== undefined) {
        psychobiologicalHabits.createdBy = user;
        psychobiologicalHabits.createdAt = new Date();
        if (lastAttentionId !== undefined) {
          psychobiologicalHabits.attentionId = lastAttentionId;
        }
        patientHistory.psychobiologicalHabits = [...patientHistory.psychobiologicalHabits, psychobiologicalHabits];
      }
      if (functionalExam !== undefined) {
        functionalExam.createdBy = user;
        functionalExam.createdAt = new Date();
        if (lastAttentionId !== undefined) {
          functionalExam.attentionId = lastAttentionId;
        }
        patientHistory.functionalExam = [...patientHistory.functionalExam, functionalExam];
      }
      if (physicalExam !== undefined) {
        physicalExam.createdBy = user;
        physicalExam.createdAt = new Date();
        if (lastAttentionId !== undefined) {
          physicalExam.attentionId = lastAttentionId;
        }
        patientHistory.physicalExam = [...patientHistory.physicalExam, physicalExam];
      }
      if (diagnostic !== undefined) {
        diagnostic.createdBy = user;
        diagnostic.createdAt = new Date();
        if (lastAttentionId !== undefined) {
          diagnostic.attentionId = lastAttentionId;
        }
        patientHistory.diagnostic = [...patientHistory.diagnostic, diagnostic];
      }
      if (medicalOrder !== undefined) {
        medicalOrder.createdBy = user;
        medicalOrder.createdAt = new Date();
        if (lastAttentionId !== undefined) {
          medicalOrder.attentionId = lastAttentionId;
        }
        patientHistory.medicalOrder = [...patientHistory.medicalOrder, medicalOrder];
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
      const patientHistoryUpdated = await this.patientHistoryRepository.update(patientHistory);
      const patientHistoryUpdatedEvent = new PatientHistoryUpdated(new Date(), patientHistoryUpdated, { user });
      publish(patientHistoryUpdatedEvent);
      return patientHistoryUpdated;
    } catch (error) {
      throw new HttpException(`Hubo un problema al modificar el patientHistory: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
