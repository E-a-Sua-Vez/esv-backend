import { Collection } from 'fireorm';

import { ClientContactResult } from './client-contact-result.enum';
import { ClientContactType } from './client-contact-type.enum';

@Collection('client-contact')
export class ClientContact {
  id: string;
  clientId: string;
  type: ClientContactType;
  result: ClientContactResult;
  commerceId: string;
  comment: string;
  collaboratorId: string;
  createdAt: Date;
  updatedAt: Date;
}
