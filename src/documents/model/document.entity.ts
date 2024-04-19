import { Collection } from 'fireorm';
import { DocumentName } from './document.enum';

export class DocumentOption {
    name: string;
    type: string;
}

@Collection('document')
export class Document {
    id: string;
    name: string;
    option: string;
    type: DocumentName;
    commerceId: string;
    clientId: string;
    active: boolean;
    location: string;
    format: string;
    createdBy: string;
    modifiedBy: string;
    createdAt: Date;
    modifiedAt: Date;
}