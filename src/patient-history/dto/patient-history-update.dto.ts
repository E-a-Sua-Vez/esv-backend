import { PersonalData, ConsultationReason, CurrentIllness, PersonalBackground, FamilyBackground, PsychobiologicalHabits, FunctionalExam, PhysicalExam, Diagnostic, MedicalOrder, AditionalInfo } from '../model/patient-history.entity';
import { PatientHistoryType } from '../model/patient-history-type.enum';

export class PatientHistoryUpdateDto {
  commerceId: string;
  clientId: string;
  type: PatientHistoryType;
  lastAttentionId: string;
  personalData: PersonalData;
  consultationReason: ConsultationReason;
  currentIllness: CurrentIllness;
  personalBackground: PersonalBackground;
  familyBackground: FamilyBackground;
  psychobiologicalHabits : PsychobiologicalHabits;
  functionalExam: FunctionalExam;
  physicalExam: PhysicalExam;
  diagnostic: Diagnostic;
  medicalOrder: MedicalOrder;
  aditionalInfo: AditionalInfo;
  active: boolean;
  available: boolean;
}
