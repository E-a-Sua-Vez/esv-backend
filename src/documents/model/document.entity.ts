import { Collection } from 'fireorm';

import { DocumentType } from './document.enum';

export class DocumentOption {
  name: string;
  type: string;
}

export class DocumentMetadata {
  clientName: string;
  clientLastName: string;
  clientIdNumber: string;
  clientEmail: string;
  optionSelected: object;
}

@Collection('document')
export class Document {
  id: string;
  name: string;
  option: string;
  type: DocumentType;
  commerceId: string;
  clientId: string;
  active: boolean;
  available: boolean;
  location: string;
  format: string;
  createdBy: string;
  modifiedBy: string;
  createdAt: Date;
  modifiedAt: Date;
  documentMetadata: DocumentMetadata;
}
