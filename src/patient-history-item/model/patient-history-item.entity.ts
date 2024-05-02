import { Collection } from 'fireorm';
import { PatientHistoryItemType } from './patient-history-type.enum';

export class ItemCharacteristics {
    actual: boolean;
    frecuency: boolean;
    ageFrom: boolean;
    ageTo: boolean;
    comment: boolean;
}

@Collection('patient-history-item')
export class PatientHistoryItem {
    id: string;
    name: string;
    type: PatientHistoryItemType;
    characteristics: ItemCharacteristics;
    commerceId: string;
    createdAt: Date;
    active: boolean;
    available: boolean;
}