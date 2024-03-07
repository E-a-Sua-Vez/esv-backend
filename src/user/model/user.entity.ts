import { Collection } from 'fireorm';
import { UserContactResult } from './user-contact-result.enum';
import { UserType } from './user-type.enum';

export class PersonalInfo {
    gender: string;
    birthday: Date;
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
    notificationOn: boolean = false;
    notificationEmailOn: boolean = false;
    updatedAt: Date;
    personalInfo: PersonalInfo;
}