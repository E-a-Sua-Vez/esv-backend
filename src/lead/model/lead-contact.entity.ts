import { Collection } from 'fireorm';

import { LeadContactResult } from './lead-contact-result.enum';
import { LeadContactType } from './lead-contact-type.enum';

@Collection('lead-contact')
export class LeadContact {
  id: string;
  leadId: string;
  type: LeadContactType;
  result?: LeadContactResult;
  comment: string;
  userId: string; // User who made the contact (master user or business admin/collaborator)
  businessId?: string; // For future extensibility to business admin
  commerceId?: string; // For filtering by commerce in business admin
  collaboratorId?: string; // Alias for userId, for consistency with ClientContact
  scheduledAt?: Date; // For scheduled contacts/meetings
  createdAt: Date;
  updatedAt: Date;
}
