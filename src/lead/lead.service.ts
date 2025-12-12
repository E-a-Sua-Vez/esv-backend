import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import LeadContactAdded from './events/LeadContactAdded';
import LeadCreated from './events/LeadCreated';
import LeadStatusChanged from './events/LeadStatusChanged';
import LeadUpdated from './events/LeadUpdated';
import { LeadContactResult } from './model/lead-contact-result.enum';
import { LeadContactType } from './model/lead-contact-type.enum';
import { LeadContact } from './model/lead-contact.entity';
import { LeadPipelineStage } from './model/lead-pipeline-stage.enum';
import { LeadStatus } from './model/lead-status.enum';
import { Lead } from './model/lead.entity';

export class LeadService {
  constructor(
    @InjectRepository(Lead)
    private leadRepository = getRepository(Lead),
    @InjectRepository(LeadContact)
    private leadContactRepository = getRepository(LeadContact)
  ) {}

  public async createLeadFromContactForm(
    contactFormData: {
      id: string;
      name: string;
      email: string;
      phone?: string;
      company?: string;
      message?: string;
      source: string;
      page?: string;
    },
    userId?: string,
    businessId?: string,
    commerceId?: string
  ): Promise<Lead> {
    const lead = new Lead();
    lead.id = contactFormData.id;
    lead.name = contactFormData.name;
    lead.email = contactFormData.email;
    lead.phone = contactFormData.phone;
    lead.company = contactFormData.company;
    lead.message = contactFormData.message;
    lead.source = contactFormData.source;
    lead.page = contactFormData.page;
    lead.contactFormSubmissionId = contactFormData.id;
    lead.pipelineStage = LeadPipelineStage.NEW;
    lead.assignedToUserId = userId;
    lead.businessId = businessId;
    lead.commerceId = commerceId;
    lead.createdAt = new Date();
    lead.updatedAt = new Date();

    const leadCreated = await this.leadRepository.create(lead);
    const leadCreatedEvent = new LeadCreated(new Date(), leadCreated);
    publish(leadCreatedEvent);
    return leadCreated;
  }

  public async getLeadById(leadId: string): Promise<Lead | null> {
    return await this.leadRepository.findById(leadId);
  }

  public async getLeadsByStage(
    stage: LeadPipelineStage,
    userId?: string,
    businessId?: string,
    commerceId?: string
  ): Promise<Lead[]> {
    // Similar to getAllLeads, include public contact form leads
    if (businessId || commerceId) {
      // Get leads matching the business/commerce filter and stage
      let query = this.leadRepository.whereEqualTo('pipelineStage', stage);
      if (userId) {
        query = query.whereEqualTo('assignedToUserId', userId);
      }
      if (businessId) {
        query = query.whereEqualTo('businessId', businessId);
      }
      if (commerceId) {
        query = query.whereEqualTo('commerceId', commerceId);
      }
      const filteredLeads = await query.orderByDescending('createdAt').find();

      // Also get public contact form leads with the same stage
      // Query by source and stage to get public leads more efficiently
      const publicContactFormLeads = await this.leadRepository
        .whereEqualTo('pipelineStage', stage)
        .whereEqualTo('source', 'contact-form')
        .orderByDescending('createdAt')
        .find();
      const publicExitIntentLeads = await this.leadRepository
        .whereEqualTo('pipelineStage', stage)
        .whereEqualTo('source', 'exit-intent')
        .orderByDescending('createdAt')
        .find();

      // Filter to only include leads without business/commerce and matching userId if provided
      const publicLeads = [...publicContactFormLeads, ...publicExitIntentLeads].filter(
        lead =>
          (!lead.businessId || lead.businessId === '') &&
          (!lead.commerceId || lead.commerceId === '') &&
          (!userId || lead.assignedToUserId === userId)
      );

      // Combine and deduplicate
      const combinedLeads = [...filteredLeads, ...publicLeads];
      const uniqueLeads = combinedLeads.filter(
        (lead, index, self) => index === self.findIndex(l => l.id === lead.id)
      );
      return uniqueLeads.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    }

    // If no business/commerce filter, return all leads for the stage
    let query = this.leadRepository.whereEqualTo('pipelineStage', stage);
    if (userId) {
      query = query.whereEqualTo('assignedToUserId', userId);
    }
    return await query.orderByDescending('createdAt').find();
  }

  public async getAllLeads(
    userId?: string,
    businessId?: string,
    commerceId?: string
  ): Promise<Lead[]> {
    // If businessId or commerceId is provided, we want to get:
    // 1. Leads that match the business/commerce filter
    // 2. Leads from public contact forms (without business/commerce) so they appear in lead management
    if (businessId || commerceId) {
      // Get leads matching the business/commerce filter
      let query: any = this.leadRepository;
      if (userId) {
        query = query.whereEqualTo('assignedToUserId', userId);
      }
      if (businessId) {
        query = query.whereEqualTo('businessId', businessId);
      }
      if (commerceId) {
        query = query.whereEqualTo('commerceId', commerceId);
      }
      const filteredLeads = await query.orderByDescending('createdAt').find();

      // Also get public contact form leads (without business/commerce) to show in lead management
      let publicQuery: any = this.leadRepository;
      if (userId) {
        publicQuery = publicQuery.whereEqualTo('assignedToUserId', userId);
      }
      // Get leads without businessId and commerceId (public contact forms)
      // Note: Firestore doesn't support "where field is null" directly, so we get all leads
      // and filter in memory, or we can use a different approach
      // For now, we'll get leads where businessId is undefined/null
      const allLeads = await this.leadRepository.orderByDescending('createdAt').find();
      const publicLeads = allLeads.filter(
        lead =>
          (!lead.businessId || lead.businessId === '') &&
          (!lead.commerceId || lead.commerceId === '') &&
          (lead.source === 'contact-form' || lead.source === 'exit-intent')
      );

      // Combine and deduplicate
      const combinedLeads = [...filteredLeads, ...publicLeads];
      const uniqueLeads = combinedLeads.filter(
        (lead, index, self) => index === self.findIndex(l => l.id === lead.id)
      );
      return uniqueLeads.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    }

    // If no business/commerce filter, return all leads (optionally filtered by userId)
    let query: any = this.leadRepository;
    if (userId) {
      query = query.whereEqualTo('assignedToUserId', userId);
    }
    return await query.orderByDescending('createdAt').find();
  }

  public async updateLeadStage(
    leadId: string,
    newStage: LeadPipelineStage,
    userId: string,
    status?: LeadStatus
  ): Promise<Lead> {
    const lead = await this.leadRepository.findById(leadId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    // Save the old stage before updating
    const oldStage = lead.pipelineStage;

    lead.pipelineStage = newStage;
    if (status) {
      lead.status = status;
    }
    lead.assignedToUserId = userId;
    lead.updatedAt = new Date();

    if (newStage === LeadPipelineStage.IN_CONTACT) {
      lead.lastContactedAt = new Date();
      lead.lastContactedByUserId = userId;
    }

    const updatedLead = await this.leadRepository.update(lead);
    const statusChangedEvent = new LeadStatusChanged(new Date(), {
      id: leadId, // aggregateId - must be 'id' for publish function to extract it
      leadId,
      oldStage: oldStage, // Use the old stage before update
      newStage,
      status,
      userId,
    });
    publish(statusChangedEvent);
    return updatedLead;
  }

  public async updateLead(leadId: string, updates: Partial<Lead>, userId: string): Promise<Lead> {
    const lead = await this.leadRepository.findById(leadId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    Object.assign(lead, updates);
    lead.updatedAt = new Date();
    // Only update assignedToUserId if explicitly provided in updates, otherwise keep current assignment
    if (updates.assignedToUserId !== undefined) {
      lead.assignedToUserId = updates.assignedToUserId;
    }

    const updatedLead = await this.leadRepository.update(lead);
    const leadUpdatedEvent = new LeadUpdated(new Date(), updatedLead);
    publish(leadUpdatedEvent);
    return updatedLead;
  }

  public async assignLead(
    leadId: string,
    assignedToUserId: string,
    assignedByUserId: string,
    businessId?: string,
    commerceId?: string
  ): Promise<Lead> {
    const lead = await this.leadRepository.findById(leadId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    lead.assignedToUserId = assignedToUserId;
    if (businessId) {
      lead.businessId = businessId;
    }
    if (commerceId) {
      lead.commerceId = commerceId;
    }
    lead.updatedAt = new Date();

    const updatedLead = await this.leadRepository.update(lead);
    const leadUpdatedEvent = new LeadUpdated(new Date(), updatedLead);
    publish(leadUpdatedEvent);
    return updatedLead;
  }

  public async addLeadContact(
    leadId: string,
    type: LeadContactType,
    result: LeadContactResult,
    comment: string,
    userId: string,
    businessId?: string,
    commerceId?: string,
    collaboratorId?: string,
    scheduledAt?: Date
  ): Promise<LeadContact> {
    const leadContact = new LeadContact();
    leadContact.leadId = leadId;
    leadContact.type = type;
    leadContact.result = result;
    leadContact.comment = comment;
    leadContact.userId = userId;
    leadContact.businessId = businessId;
    leadContact.commerceId = commerceId;
    leadContact.collaboratorId = collaboratorId || userId; // Use userId as fallback for consistency
    leadContact.scheduledAt = scheduledAt;
    leadContact.createdAt = new Date();
    leadContact.updatedAt = new Date();

    const createdContact = await this.leadContactRepository.create(leadContact);

    // Update lead's last contacted info
    const lead = await this.leadRepository.findById(leadId);
    if (lead) {
      lead.lastContactedAt = new Date();
      lead.lastContactedByUserId = userId;
      lead.updatedAt = new Date();
      await this.leadRepository.update(lead);
    }

    // Include userId in metadata for event consumer
    // Note: The contact object has leadId, but we need to ensure aggregateId is set correctly
    const contactData = {
      ...createdContact,
      id: leadId, // aggregateId - must be 'id' for publish function to extract it
    };
    const contactAddedEvent = new LeadContactAdded(new Date(), contactData, {
      userId: userId || 'system',
      businessId: businessId,
      commerceId: commerceId,
    });
    publish(contactAddedEvent);
    return createdContact;
  }

  public async getLeadContacts(leadId: string): Promise<LeadContact[]> {
    return await this.leadContactRepository
      .whereEqualTo('leadId', leadId)
      .orderByDescending('createdAt')
      .find();
  }

  public async createLeadFromContactFormId(contactFormId: string, userId?: string): Promise<Lead> {
    // Check if lead already exists for this contact form
    const existingLead = await this.leadRepository
      .whereEqualTo('contactFormSubmissionId', contactFormId)
      .findOne();

    if (existingLead) {
      return existingLead;
    }

    // Fetch contact form data from query stack via HTTP
    // Note: In a real implementation, you might want to inject an HTTP service
    // For now, we'll create the lead with the contact form ID and let the frontend
    // or a background job fetch the details
    const lead = new Lead();
    lead.id = contactFormId;
    lead.contactFormSubmissionId = contactFormId;
    lead.pipelineStage = LeadPipelineStage.NEW;
    lead.assignedToUserId = userId;
    lead.createdAt = new Date();
    lead.updatedAt = new Date();
    // The rest of the data will be populated when the contact form data is fetched
    // This is a simplified version - in production, you'd fetch from query stack

    const leadCreated = await this.leadRepository.create(lead);
    const leadCreatedEvent = new LeadCreated(new Date(), leadCreated);
    publish(leadCreatedEvent);
    return leadCreated;
  }
}
