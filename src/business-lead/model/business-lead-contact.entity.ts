import { Collection } from 'fireorm';

import { LeadContactResult } from '../../lead/model/lead-contact-result.enum';
import { LeadContactType } from '../../lead/model/lead-contact-type.enum';

@Collection('business-lead-contact')
export class BusinessLeadContact {
  id: string;
  businessLeadId: string; // Reference to the BusinessLead

  // Contact details
  type: LeadContactType; // CALL, MESSAGE, EMAIL, VISIT, MEETING
  result: LeadContactResult; // INTERESTED, CONTACT_LATER, REJECTED, NO_RESPONSE, WAITING_FOR_RESPONSE
  comment: string;

  // Business context for filtering and permissions
  businessId: string;
  commerceId: string;

  // Tracking who made the contact
  userId?: string; // Admin/business user who made contact
  collaboratorId?: string; // Collaborator who made contact

  // Timestamps
  createdAt: Date;
  updatedAt?: Date;
  scheduledAt?: Date; // For scheduled follow-ups
}
