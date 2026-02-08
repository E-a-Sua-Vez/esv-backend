import { Collection } from 'fireorm';

import { LeadPipelineStage } from '../../lead/model/lead-pipeline-stage.enum';
import { LeadStatus } from '../../lead/model/lead-status.enum';
import { LeadTemperature } from '../../lead/model/lead-temperature.enum';

export class PersonalInfo {
  birthday?: string;
  addressText?: string;
  addressCode?: string;
  addressComplement?: string;
  origin?: string;
  code1?: string;
  code2?: string;
  code3?: string;
  healthAgreementId?: string;
}

@Collection('business-lead')
export class BusinessLead {
  id: string;

  // Basic lead information
  name: string;
  lastName?: string;
  email: string;
  phone?: string;
  idNumber?: string; // CPF/RUT for BR/CL
  company?: string;
  message?: string;

  // Business context - CRITICAL for filtering and permissions
  businessId: string; // Required - the business that owns this lead
  commerceId: string; // Required - specific commerce

  // Source tracking
  source: string; // 'manual', 'website', 'contact-form', 'referral', 'campaign', etc.
  page?: string; // URL where the lead came from
  contactFormSubmissionId?: string; // Reference to original contact form if applicable

  // Pipeline management
  pipelineStage: LeadPipelineStage; // NEW, IN_CONTACT, WAITLIST, IN_DEAL, CLOSED, ARCHIVED
  status?: LeadStatus; // INTERESTED, REJECTED, MAYBE_LATER, SUCCESS
  temperature?: LeadTemperature; // QUENTE (hot/red), MORNO (warm/green), FRIO (cold/blue)

  // Assignment and tracking - WHO created/manages this lead
  createdByUserId?: string; // User who created the lead (admin/business user)
  createdByCollaboratorId?: string; // Collaborator who created the lead
  assignedToUserId?: string; // User currently assigned (for admin/business view)
  assignedToCollaboratorId?: string; // Collaborator currently assigned

  // Personal info for client conversion
  personalInfo?: PersonalInfo;

  // Product interest tracking - OPTIONAL: which product the lead is interested in
  productId?: string; // ID of the product the lead is interested in

  // Client conversion tracking - BIDIRECTIONAL REFERENCE
  convertedToClientId?: string; // ID of the client when converted
  convertedAt?: Date; // Date of conversion
  convertedByUserId?: string; // Who performed the conversion

  // Additional notes and metadata
  notes?: string;
  metadata?: object;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastContactedAt?: Date; // Last time someone contacted this lead
  lastContactedByUserId?: string; // User who last contacted
  lastContactedByCollaboratorId?: string; // Collaborator who last contacted
}
