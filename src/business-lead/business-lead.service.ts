import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { ClientService } from '../client/client.service';
import { PersonalInfo as ClientPersonalInfo } from '../client/model/client.entity';
import { LeadContactResult } from '../lead/model/lead-contact-result.enum';
import { LeadContactType } from '../lead/model/lead-contact-type.enum';
import { LeadPipelineStage } from '../lead/model/lead-pipeline-stage.enum';
import { LeadStatus } from '../lead/model/lead-status.enum';
import { LeadTemperature } from '../lead/model/lead-temperature.enum';

import BusinessLeadContactAdded from './events/BusinessLeadContactAdded';
import BusinessLeadConverted from './events/BusinessLeadConverted';
import BusinessLeadCreated from './events/BusinessLeadCreated';
import BusinessLeadStatusChanged from './events/BusinessLeadStatusChanged';
import BusinessLeadUpdated from './events/BusinessLeadUpdated';
import { BusinessLeadContact } from './model/business-lead-contact.entity';
import { BusinessLead } from './model/business-lead.entity';

@Injectable()
export class BusinessLeadService {
  constructor(
    @InjectRepository(BusinessLead)
    private businessLeadRepository = getRepository(BusinessLead),
    @InjectRepository(BusinessLeadContact)
    private businessLeadContactRepository = getRepository(BusinessLeadContact),
    private clientService: ClientService
  ) {}

  // Create new business lead
  public async createBusinessLead(
    leadData: {
      id: string;
      name: string;
      lastName?: string;
      email: string;
      phone?: string;
      idNumber?: string;
      company?: string;
      message?: string;
      source: string;
      page?: string;
      temperature?: LeadTemperature;
      personalInfo?: any;
      productId?: string;
    },
    businessId: string,
    commerceId: string,
    userId?: string,
    collaboratorId?: string
  ): Promise<BusinessLead> {
    const lead = new BusinessLead();
    lead.id = leadData.id;
    lead.name = leadData.name;
    lead.lastName = leadData.lastName || '';
    lead.email = leadData.email;
    lead.phone = leadData.phone || '';
    lead.idNumber = leadData.idNumber || '';
    lead.company = leadData.company || '';
    lead.message = leadData.message || '';
    lead.source = leadData.source;
    lead.page = leadData.page || '';
    lead.temperature = leadData.temperature || LeadTemperature.MORNO;
    lead.personalInfo = leadData.personalInfo || {};
    lead.productId = leadData.productId || null;

    // Business context
    lead.businessId = businessId;
    lead.commerceId = commerceId;

    // Tracking who created the lead
    lead.createdByUserId = userId;
    lead.createdByCollaboratorId = collaboratorId;
    lead.assignedToUserId = userId;
    lead.assignedToCollaboratorId = collaboratorId;

    // Initial pipeline stage
    lead.pipelineStage = LeadPipelineStage.NEW;
    lead.status = null;

    // Timestamps
    lead.createdAt = new Date();
    lead.updatedAt = new Date();

    const savedLead = await this.businessLeadRepository.create(lead);

    // Publish event
    const event = new BusinessLeadCreated(new Date(), {
      id: savedLead.id,
      businessLeadId: savedLead.id,
      name: savedLead.name,
      lastName: savedLead.lastName,
      email: savedLead.email,
      phone: savedLead.phone,
      idNumber: savedLead.idNumber,
      company: savedLead.company,
      message: savedLead.message,
      source: savedLead.source,
      page: savedLead.page,
      temperature: savedLead.temperature,
      personalInfo: savedLead.personalInfo,
      businessId: savedLead.businessId,
      commerceId: savedLead.commerceId,
      pipelineStage: savedLead.pipelineStage,
      status: savedLead.status,
      createdByUserId: savedLead.createdByUserId,
      createdByCollaboratorId: savedLead.createdByCollaboratorId,
      assignedToUserId: savedLead.assignedToUserId,
      assignedToCollaboratorId: savedLead.assignedToCollaboratorId,
      createdAt: savedLead.createdAt,
      updatedAt: savedLead.updatedAt,
    });

    await publish(event);

    return savedLead;
  }

  // Get lead by ID
  public async getBusinessLeadById(leadId: string): Promise<BusinessLead | null> {
    try {
      return await this.businessLeadRepository.findById(leadId);
    } catch (error) {
      return null;
    }
  }

  // Get leads by stage with filters
  public async getBusinessLeadsByStage(
    stage: LeadPipelineStage,
    businessId?: string,
    commerceId?: string,
    collaboratorId?: string,
    userId?: string
  ): Promise<BusinessLead[]> {
    let query = this.businessLeadRepository.whereEqualTo('pipelineStage', stage);

    // Apply business filter
    if (businessId) {
      query = query.whereEqualTo('businessId', businessId);
    }

    // Apply commerce filter
    if (commerceId) {
      query = query.whereEqualTo('commerceId', commerceId);
    }

    // Apply collaborator filter
    if (collaboratorId) {
      query = query.whereEqualTo('assignedToCollaboratorId', collaboratorId);
    }

    // Apply user filter
    if (userId) {
      query = query.whereEqualTo('assignedToUserId', userId);
    }

    return await query.orderByDescending('createdAt').find();
  }

  // Get all leads with filters
  public async getAllBusinessLeads(
    businessId?: string,
    commerceId?: string,
    collaboratorId?: string,
    userId?: string
  ): Promise<BusinessLead[]> {
    const query = this.businessLeadRepository.orderByDescending('createdAt');

    // Note: Firebase doesn't support multiple where clauses with orderBy efficiently
    // We'll fetch all and filter in memory
    const allLeads = await query.find();

    return allLeads.filter(lead => {
      if (businessId && lead.businessId !== businessId) return false;
      if (commerceId && lead.commerceId !== commerceId) return false;
      if (collaboratorId && lead.assignedToCollaboratorId !== collaboratorId) return false;
      if (userId && lead.assignedToUserId !== userId) return false;
      return true;
    });
  }

  // Update lead stage
  public async updateBusinessLeadStage(
    leadId: string,
    newStage: LeadPipelineStage,
    userId: string,
    status?: LeadStatus,
    collaboratorId?: string
  ): Promise<BusinessLead> {
    const lead = await this.businessLeadRepository.findById(leadId);
    if (!lead) {
      throw new HttpException('Business lead not found', HttpStatus.NOT_FOUND);
    }

    const oldStage = lead.pipelineStage;
    lead.pipelineStage = newStage;

    if (status) {
      lead.status = status;
    }

    lead.updatedAt = new Date();

    // Update contact tracking when moving to IN_CONTACT
    if (newStage === LeadPipelineStage.IN_CONTACT) {
      lead.lastContactedAt = new Date();
      lead.lastContactedByUserId = userId;
      lead.lastContactedByCollaboratorId = collaboratorId;
    }

    const updatedLead = await this.businessLeadRepository.update(lead);

    // Publish event
    const event = new BusinessLeadStatusChanged(new Date(), {
      id: leadId,
      businessLeadId: leadId,
      oldStage,
      newStage,
      status: lead.status,
      businessId: lead.businessId,
      commerceId: lead.commerceId,
      userId,
      collaboratorId,
      updatedAt: lead.updatedAt,
    });

    await publish(event);

    return updatedLead;
  }

  // Update lead
  public async updateBusinessLead(
    leadId: string,
    updates: Partial<BusinessLead>,
    userId: string,
    collaboratorId?: string
  ): Promise<BusinessLead> {
    const lead = await this.businessLeadRepository.findById(leadId);
    if (!lead) {
      throw new HttpException('Business lead not found', HttpStatus.NOT_FOUND);
    }

    // Apply updates
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && key !== 'id') {
        lead[key] = updates[key];
      }
    });

    lead.updatedAt = new Date();

    const updatedLead = await this.businessLeadRepository.update(lead);

    // Publish event
    const event = new BusinessLeadUpdated(new Date(), {
      id: leadId,
      businessLeadId: leadId,
      ...updates,
      businessId: lead.businessId,
      commerceId: lead.commerceId,
      userId,
      collaboratorId,
      updatedAt: lead.updatedAt,
    });

    await publish(event);

    return updatedLead;
  }

  // Add contact to lead
  public async addBusinessLeadContact(
    leadId: string,
    type: LeadContactType,
    result: LeadContactResult,
    comment: string,
    userId?: string,
    collaboratorId?: string
  ): Promise<BusinessLeadContact> {
    const lead = await this.businessLeadRepository.findById(leadId);
    if (!lead) {
      throw new HttpException('Business lead not found', HttpStatus.NOT_FOUND);
    }

    const contact = new BusinessLeadContact();
    contact.id = `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    contact.businessLeadId = leadId;
    contact.type = type;
    contact.result = result;
    contact.comment = comment;
    contact.businessId = lead.businessId;
    contact.commerceId = lead.commerceId;
    contact.userId = userId;
    contact.collaboratorId = collaboratorId;
    contact.createdAt = new Date();

    const savedContact = await this.businessLeadContactRepository.create(contact);

    // Update lead's last contact info
    lead.lastContactedAt = new Date();
    lead.lastContactedByUserId = userId;
    lead.lastContactedByCollaboratorId = collaboratorId;
    lead.updatedAt = new Date();
    await this.businessLeadRepository.update(lead);

    // Publish event
    const event = new BusinessLeadContactAdded(new Date(), {
      id: savedContact.id,
      contactId: savedContact.id,
      businessLeadId: leadId,
      type: savedContact.type,
      result: savedContact.result,
      comment: savedContact.comment,
      businessId: savedContact.businessId,
      commerceId: savedContact.commerceId,
      userId,
      collaboratorId,
      createdAt: savedContact.createdAt,
    });

    await publish(event);

    return savedContact;
  }

  // Get contacts for a lead
  public async getBusinessLeadContacts(leadId: string): Promise<BusinessLeadContact[]> {
    return await this.businessLeadContactRepository
      .whereEqualTo('businessLeadId', leadId)
      .orderByDescending('createdAt')
      .find();
  }

  // Convert lead to client - BIDIRECTIONAL REFERENCE
  public async convertBusinessLeadToClient(
    leadId: string,
    userId: string,
    collaboratorId?: string
  ): Promise<{ lead: BusinessLead; client: any }> {
    const lead = await this.businessLeadRepository.findById(leadId);
    if (!lead) {
      throw new HttpException('Business lead not found', HttpStatus.NOT_FOUND);
    }

    if (lead.convertedToClientId) {
      throw new HttpException('Lead already converted to client', HttpStatus.BAD_REQUEST);
    }

    // Check if client already exists with idNumber or email
    let existingClient = null;
    if (lead.idNumber || lead.email) {
      try {
        existingClient = await this.clientService.getClientByIdNumberOrEmail(
          lead.businessId,
          lead.idNumber || '',
          lead.email
        );
      } catch (error) {
        // Client doesn't exist, we'll create a new one
      }
    }

    let client: any;

    if (existingClient) {
      // Update existing client with lead info
      client = await this.clientService.update(userId, {
        ...existingClient,
        phone: lead.phone || existingClient.phone,
        personalInfo: {
          ...existingClient.personalInfo,
          ...lead.personalInfo,
        },
        // Add lead reference
        convertedFromBusinessLeadId: lead.id,
        convertedFromLeadAt: new Date(),
        metadata: {
          ...existingClient.metadata,
          leadSource: lead.source,
          leadTemperature: lead.temperature,
          leadNotes: lead.notes,
        },
      });
    } else {
      // Create new client
      client = await this.clientService.saveClient(
        undefined, // clientId
        lead.businessId,
        lead.commerceId,
        lead.name,
        lead.phone || '',
        lead.email,
        lead.lastName || '',
        lead.idNumber || '',
        (lead.personalInfo || {}) as ClientPersonalInfo
      );

      // Update client with lead reference fields
      client.convertedFromBusinessLeadId = lead.id;
      client.convertedFromLeadAt = new Date();
      await this.clientService.update(client.id, client);
    }

    // Update lead with client reference
    lead.convertedToClientId = client.id;
    lead.convertedAt = new Date();
    lead.convertedByUserId = userId;
    lead.status = LeadStatus.SUCCESS;
    lead.pipelineStage = LeadPipelineStage.CLOSED;
    lead.updatedAt = new Date();

    const updatedLead = await this.businessLeadRepository.update(lead);

    // Publish event
    const event = new BusinessLeadConverted(new Date(), {
      id: lead.id,
      businessLeadId: lead.id,
      clientId: client.id,
      businessId: lead.businessId,
      commerceId: lead.commerceId,
      convertedByUserId: userId,
      collaboratorId,
      convertedAt: lead.convertedAt,
    });

    await publish(event);

    return { lead: updatedLead, client };
  }
}
