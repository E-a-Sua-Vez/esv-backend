import { Collection } from 'fireorm';
import { ClientContactType } from './client-contact-type.enum';

@Collection('client-contact')
export class ClientContact {
    id: string;
    clientId: string;
    type: ClientContactType;
    commerceId: string;
    comment: string;
    collaboratorId: string;
    createdAt: Date;
    updatedAt: Date;
}