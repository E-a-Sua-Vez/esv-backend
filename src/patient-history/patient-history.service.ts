import { ConsultationReason, CurrentIllness, Diagnostic, FunctionalExam, MedicalOrder, PatientHistory, PersonalData, PhysicalExam, PatientAnamnese, AditionalInfo, Control, PatientDocument } from './model/patient-history.entity';
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
    consultationReason: ConsultationReason, currentIllness: CurrentIllness, patientAnamnese: PatientAnamnese, functionalExam: FunctionalExam,
    physicalExam: PhysicalExam, diagnostic: Diagnostic, medicalOrder: MedicalOrder, control: Control, aditionalInfo: AditionalInfo, active: boolean,
    available: boolean, lastAttentionId: string, patientDocument: PatientDocument): Promise<PatientHistory> {
    let patientHistory = await this.getPatientHistorysByClientId(commerceId, clientId);
    if (patientHistory && patientHistory.id) {
      patientHistory = await this.updatePatientHistoryConfigurations(user, patientHistory.id, personalData, consultationReason, currentIllness,
        patientAnamnese, functionalExam, physicalExam, diagnostic, medicalOrder, control, aditionalInfo, active, available, lastAttentionId, patientDocument);
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
      patientHistory = await this.createPatientHistory(user, commerceId, clientId, type, personalData, [consultationReason], [currentIllness],
        patientAnamnese, [functionalExam], [physicalExam], [diagnostic], [medicalOrder], [control], aditionalInfo, lastAttentionId, [patientDocument]);
    }
    return patientHistory;
  }

  public async createPatientHistory(user: string, commerceId: string, clientId: string, type: PatientHistoryType, personalData: PersonalData,
    consultationReason: ConsultationReason[], currentIllness: CurrentIllness[], patientAnamnese : PatientAnamnese, functionalExam: FunctionalExam[],
    physicalExam: PhysicalExam[], diagnostic: Diagnostic[], medicalOrder: MedicalOrder[], control: Control[], aditionalInfo: AditionalInfo,
    lastAttentionId: string, patientDocument: PatientDocument[]): Promise<PatientHistory> {
    let patientHistory = new PatientHistory();
    patientHistory.commerceId = commerceId;
    patientHistory.clientId = clientId;
    patientHistory.type = type || PatientHistoryType.STANDARD;
    patientHistory.personalData = personalData;
    patientHistory.consultationReason = consultationReason;
    patientHistory.currentIllness = currentIllness;
    patientHistory.patientAnamnese = patientAnamnese;
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
    const patientHistoryCreated = await this.patientHistoryRepository.create(patientHistory);
    const patientHistoryCreatedEvent = new PatientHistoryCreated(new Date(), patientHistoryCreated, { user });
    publish(patientHistoryCreatedEvent);
    return patientHistoryCreated;
  }

  public async updatePatientHistoryConfigurations(user: string, id: string, personalData: PersonalData,
    consultationReason: ConsultationReason, currentIllness: CurrentIllness, patientAnamnese: PatientAnamnese, functionalExam: FunctionalExam,
    physicalExam: PhysicalExam, diagnostic: Diagnostic, medicalOrder: MedicalOrder, control: Control, aditionalInfo: AditionalInfo,
    active: boolean, available: boolean, lastAttentionId: string, patientDocument: PatientDocument): Promise<PatientHistory> {
    try {
      let patientHistory = await this.patientHistoryRepository.findById(id);
      if (personalData !== undefined) {
        personalData.modifiedBy = user;
        personalData.modifiedAt = new Date();
        patientHistory.personalData = personalData;
      }
      if (consultationReason !== undefined &&
        consultationReason.reason !== undefined &&
        consultationReason.reason.length > 0) {
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
          if (patientHistory.consultationReason) {
            patientHistory.consultationReason = [...patientHistory.consultationReason, consultationReason];
          } else {
            patientHistory.consultationReason = [consultationReason];
          }
        }
      }
      if (currentIllness !== undefined &&
        currentIllness.illness !== undefined &&
        currentIllness.illness.length > 0) {
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
          if (patientHistory.currentIllness) {
            patientHistory.currentIllness = [...patientHistory.currentIllness, currentIllness];
          } else {
            patientHistory.currentIllness = [currentIllness];
          }
        }
      }
      if (patientAnamnese !== undefined) {
        patientAnamnese.modifiedBy = user;
        patientAnamnese.modifiedAt = new Date();
        if (lastAttentionId !== undefined) {
          patientAnamnese.attentionId = lastAttentionId;
        }
        patientHistory.patientAnamnese = { ...patientHistory.patientAnamnese, ...patientAnamnese };
      }
      if (functionalExam !== undefined &&
        functionalExam.exam !== undefined &&
        functionalExam.exam.length > 0) {
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
          functionalExam.createdBy = user;
          functionalExam.createdAt = new Date();
          if (patientHistory.functionalExam) {
            patientHistory.functionalExam = [...patientHistory.functionalExam, functionalExam];
          } else {
            patientHistory.functionalExam = [functionalExam];
          }
        }
      }
      if (physicalExam !== undefined && (
        (physicalExam.exam !== undefined && physicalExam.exam.length > 0) ||
        (physicalExam.examDetails && Object.keys(physicalExam.examDetails).length > 0))
      ) {
        if (lastAttentionId !== undefined) {
          physicalExam.attentionId = lastAttentionId;
        }
        if (patientHistory.physicalExam && patientHistory.physicalExam.length > 0) {
          const todayResults = patientHistory.physicalExam.filter(exam => getDateFormatted(exam.createdAt ? exam.createdAt : new Date()) === getDateFormatted(new Date()));
          if (todayResults && todayResults.length === 1) {
            const todayResult = todayResults[0];
            const newResult = { ...todayResult, ...physicalExam };
            const resultsAux = patientHistory.physicalExam.filter(exam => getDateFormatted(exam.createdAt ? exam.createdAt : new Date()) !== getDateFormatted(new Date()));
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
      if (diagnostic !== undefined &&
        diagnostic.diagnostic !== undefined &&
        diagnostic.diagnostic.length > 0) {
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
          if (patientHistory.diagnostic) {
            patientHistory.diagnostic = [...patientHistory.diagnostic, diagnostic];
          } else {
            patientHistory.diagnostic = [diagnostic];
          }
        }
      }
      if (control !== undefined &&
        control.scheduledDate !== undefined &&
        control.status !== undefined &&
        control.reason !== undefined) {
        if (lastAttentionId !== undefined) {
          control.attentionId = lastAttentionId;
        }
        if (patientHistory.control && patientHistory.control.length > 0) {
          const todayResults = patientHistory.control.filter(ctrl => getDateFormatted(new Date(ctrl.scheduledDate)) === getDateFormatted(new Date(control.scheduledDate)));
          if (todayResults && todayResults.length === 1) {
            const todayResult = todayResults[0];
            const newResult = { ...todayResult, ...control };
            const resultsAux = patientHistory.control.filter(ctrl => getDateFormatted(new Date(ctrl.scheduledDate)) !== getDateFormatted(new Date(control.scheduledDate)));
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
      if (medicalOrder !== undefined &&
        medicalOrder.medicalOrder !== undefined &&
        medicalOrder.medicalOrder.length > 0) {
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
          if (patientHistory.medicalOrder) {
            patientHistory.medicalOrder = [...patientHistory.medicalOrder, medicalOrder];
          } else {
            patientHistory.medicalOrder = [medicalOrder];
          }
        }
      }
      if (patientDocument !== undefined) {
        if (lastAttentionId !== undefined) {
          patientDocument.attentionId = lastAttentionId;
        }
        patientDocument.createdBy = user;
        patientDocument.createdAt = new Date();
        if (patientHistory.patientDocument) {
          patientHistory.patientDocument = [...patientHistory.patientDocument, patientDocument];
        } else {
          patientHistory.patientDocument = [patientDocument];
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

  public async updatePatientHistoryControl(user: string, id: string, control: Control[], patientDocument: PatientDocument[], lastAttentionId: string): Promise<PatientHistory> {
    try {
      let patientHistory = await this.patientHistoryRepository.findById(id);
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
        patientHistory.modifiedAt = new Date();
        patientHistory.modifiedBy = user;
        const patientHistoryUpdated = await this.patientHistoryRepository.update(patientHistory);
        const patientHistoryUpdatedEvent = new PatientHistoryUpdated(new Date(), patientHistoryUpdated, { user });
        publish(patientHistoryUpdatedEvent);
        return patientHistoryUpdated;
      }
    } catch (error) {
      throw new HttpException(`Hubo un problema al modificar el control patientHistory: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
