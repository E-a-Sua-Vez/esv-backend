import { Collection } from 'fireorm';
import { PatientHistoryType } from './patient-history-type.enum';

export class PersonalData {
    name: string;
    lastName: string;
    idNumber: string;
    birthday: string;
    age: number;
    civilStatus: string;
    sex: string;
    occupation: string;
    addressText: string;
    addressCode: string;
    addressComplement: string;
    phone: string;
    font: boolean;
    attentionId: string;
    createdAt: Date;
    createdBy: string;
    modifiedAt: Date;
    modifiedBy: string;
}

export class ConsultationReason {
    reason: string;
    attentionId: string;
    createdAt: Date;
    createdBy: string;
}

export class CurrentIllness {
    illness: string;
    attentionId: string;
    createdAt: Date;
    createdBy: string;
}

export class PersonalBackground {
    background: string;
    attentionId: string;
    createdAt: Date;
    createdBy: string;
}

export class FamilyBackground {
    background: string;
    attentionId: string;
    createdAt: Date;
    createdBy: string;
}

export class ItemCharacteristics {
    id: string;
    name: string;
    active: boolean;
    actual: boolean;
    frequency: string;
    ageFrom: number;
    ageTo: number;
    comment: string;
}

export class PsychobiologicalHabits {
    habits: string;
    habitsDetails: Record<string, ItemCharacteristics>;
    attentionId: string;
    createdAt: Date;
    createdBy: string;
    modifiedAt: Date;
    modifiedBy: string;
}

export class PhysicalExam {
    exam: string;
    attentionId: string;
    createdAt: Date;
    createdBy: string;
}

export class FunctionalExam {
    exam: string;
    attentionId: string;
    createdAt: Date;
    createdBy: string;
}

export class Diagnostic {
    diagnostic: string;
    attentionId: string;
    createdAt: Date;
    createdBy: string;
}

export class MedicalOrder {
    medicalOrder: string;
    attentionId: string;
    createdAt: Date;
    createdBy: string;
}

export class AditionalInfo {
    modifiedAt: Date;
    modifiedBy: string;
}

@Collection('patient-history')
export class PatientHistory {
    id: string;
    commerceId: string;
    clientId: string;
    lastAttentionId: string;
    type: PatientHistoryType;
    personalData: PersonalData;
    consultationReason: ConsultationReason[];
    currentIllness: CurrentIllness[];
    personalBackground: PersonalBackground[];
    familyBackground: FamilyBackground[];
    psychobiologicalHabits : PsychobiologicalHabits;
    functionalExam: FunctionalExam[];
    physicalExam: PhysicalExam[];
    diagnostic: Diagnostic[];
    medicalOrder: MedicalOrder[];
    aditionalInfo: AditionalInfo;
    active: boolean;
    available: boolean;
    createdAt: Date;
    createdBy: string;
    modifiedAt: Date;
    modifiedBy: string;
}