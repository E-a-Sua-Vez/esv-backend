import { PersonalData, ConsultationReason, CurrentIllness, PatientAnamnese, FunctionalExam, PhysicalExam, Diagnostic, MedicalOrder, AditionalInfo, Control, PatientDocument } from '../model/patient-history.entity';
import { PatientHistoryType } from '../model/patient-history-type.enum';

export class PatientHistoryUpdateDto {
  commerceId: string;
  clientId: string;
  type: PatientHistoryType;
  lastAttentionId: string;
  personalData: PersonalData;
  consultationReason: ConsultationReason;
  currentIllness: CurrentIllness;
  patientAnamnese: PatientAnamnese;
  functionalExam: FunctionalExam;
  physicalExam: PhysicalExam;
  diagnostic: Diagnostic;
  medicalOrder: MedicalOrder;
  patientDocument: PatientDocument;
  control: Control;
  aditionalInfo: AditionalInfo;
  active: boolean;
  available: boolean;
}
