import { Collection } from 'fireorm';

import { LeadPipelineStage } from './lead-pipeline-stage.enum';
import { LeadStatus } from './lead-status.enum';
import { LeadTemperature } from './lead-temperature.enum';

@Collection('lead')
export class Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  source: string; // e.g., 'contact-form', 'exit-intent', 'referral'
  page?: string; // URL where the lead came from
  contactFormSubmissionId?: string; // Reference to original contact form if applicable
  pipelineStage: LeadPipelineStage;
  status?: LeadStatus; // Final status when in CLOSED stage
  temperature?: LeadTemperature; // Lead priority: QUENTE (hot/red), MORNO (warm/green), FRIO (cold/blue)
  assignedToUserId?: string; // User who is handling this lead (collaborator)
  businessId?: string; // For future extensibility to business admin
  commerceId?: string; // For filtering by commerce in business admin
  notes?: string; // Additional notes about the lead
  metadata?: object; // Additional metadata
  createdAt: Date;
  updatedAt: Date;
  lastContactedAt?: Date; // Last time someone contacted this lead
  lastContactedByUserId?: string; // User who last contacted this lead
}
