import { Collection } from 'fireorm';
import { PatientHistoryType } from './patient-history-type.enum';
import { PatientHistoryControlStatus } from './patient-history-control-status.enum';
import { PatientHistoryControlReason } from './patient-history-control-reason.enum';
import { Document } from '../../documents/model/document.entity';
import { PatientHistoryItem } from '../../patient-history-item/model/patient-history-item.entity';

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

export class ItemCharacteristics {
    id: string;
    name: string;
    tag: string;
    active: boolean;
    actual: boolean;
    frequency: string;
    ageFrom: number;
    ageTo: number;
    comment: string;
    value: number;
    result: string;
    document: boolean;
}

export class PatientAnamnese {
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
    examDetails: Record<string, ItemCharacteristics>;
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

export class Control {
    controlResult: string;
    scheduledDate: Date;
    reason: PatientHistoryControlReason;
    status: PatientHistoryControlStatus;
    attentionId: string;
    createdAt: Date;
    createdBy: string;
}

export class AditionalInfo {
    modifiedAt: Date;
    modifiedBy: string;
}

export class PatientDocument {
    documents: Document;
    comment: string;
    details: PatientHistoryItem;
    attentionId: string;
    createdAt: Date;
    createdBy: string;
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
    patientAnamnese : PatientAnamnese;
    functionalExam: FunctionalExam[];
    physicalExam: PhysicalExam[];
    diagnostic: Diagnostic[];
    medicalOrder: MedicalOrder[];
    control: Control[];
    patientDocument: PatientDocument[];
    aditionalInfo: AditionalInfo;
    active: boolean;
    available: boolean;
    createdAt: Date;
    createdBy: string;
    modifiedAt: Date;
    modifiedBy: string;
}