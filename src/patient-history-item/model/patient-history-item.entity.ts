import { Collection } from 'fireorm';

import { PatientHistoryItemType } from './patient-history-type.enum';

export class ItemCharacteristics {
  check: boolean;
  actual: boolean;
  frequency: boolean;
  ageFrom: boolean;
  ageTo: boolean;
  comment: boolean;
  value: boolean;
  result: boolean;
  selectN: boolean;
  select1: boolean;
  yesNo: boolean;
  options: string;
  document: string;
}

@Collection('patient-history-item')
export class PatientHistoryItem {
  id: string;
  name: string;
  type: PatientHistoryItemType;
  tag: string;
  order: number;
  characteristics: ItemCharacteristics;
  commerceId: string;
  createdAt: Date;
  online: boolean;
  active: boolean;
  available: boolean;
}
