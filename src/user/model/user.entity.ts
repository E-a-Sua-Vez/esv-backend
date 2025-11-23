import { Collection } from 'fireorm';

import { UserType } from './user-type.enum';

export class PersonalInfo {
  birthday: string;
  addressText: string;
  addressCode: string;
  addressComplement: string;
  origin: string;
  code1: string;
  code2: string;
  code3: string;
  healthAgreementId: string;
}

@Collection('user')
export class User {
  id: string;
  frequentCustomer: boolean;
  type: UserType;
  idNumber: string;
  name: string;
  lastName: string;
  email: string;
  phone: string;
  businessId: string;
  commerceId: string;
  queueId: string;
  country: string;
  createdAt: Date;
  notificationOn = false;
  notificationEmailOn = false;
  acceptTermsAndConditions = false;
  updatedAt: Date;
  personalInfo: PersonalInfo;
  clientId?: string;
}
