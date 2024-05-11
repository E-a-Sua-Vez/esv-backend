import { Collection } from 'fireorm';
import { ClientType } from './client-type.enum';
import { ClientContact } from '../../client-contact/model/client-contact.entity';
import { ClientContactResult } from './client-contact-result.enum';

export class PersonalInfo {
    birthday: string;
    addressText: string;
    addressCode: string;
    addressComplement: string;
    origin: string;
    code1: string;
    code2: string;
    code3: string;
}

@Collection('client')
export class Client {
    id: string;
    frequentCustomer: boolean;
    type: ClientType;
    commerceId: string;
    businessId: string;
    idNumber: string;
    name: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    createdAt: Date;
    updatedAt: Date;
    personalInfo: PersonalInfo;
    contacted?: boolean;
    contactedDate?: Date;
    contactResult?: ClientContactResult;
    contactResultComment?: string;
    contactResultCollaboratorId?: string;
    counter: number;
    clientContacts?: ClientContact[];
    firstAttentionForm?: boolean;
    conditionsAccepted?: boolean;
}