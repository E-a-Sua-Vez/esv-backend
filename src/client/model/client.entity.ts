import { Collection } from 'fireorm';
import { ClientContactType } from 'src/client-contact/model/client-contact-type.enum';
import { ClientType } from './client-type.enum';
import { ClientContact } from '../../client-contact/model/client-contact.entity';

export class PersonalInfo {
    gender: string;
    birthday: Date;
}

@Collection('client')
export class Client {
    id: string;
    frequentCustomer: boolean;
    type: ClientType;
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
    contactResult?: ClientContactType;
    contactResultComment?: string;
    contactResultCollaboratorId?: string;
    counter: number;
    clientContacts?: ClientContact[];
}