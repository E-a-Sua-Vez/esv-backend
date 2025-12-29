import { Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { AuthGuard } from '../auth/auth.guard';
import { SimpleGuard } from '../auth/simple.guard';
import { User } from '../auth/user.decorator';

import { LeadService } from './lead.service';
import { LeadContactResult } from './model/lead-contact-result.enum';
import { LeadContactType } from './model/lead-contact-type.enum';
import { LeadPipelineStage } from './model/lead-pipeline-stage.enum';
import { LeadStatus } from './model/lead-status.enum';
import { LeadTemperature } from './model/lead-temperature.enum';

@ApiTags('lead')
@Controller('lead')
export class LeadController {
  constructor(private leadService: LeadService) {}

  // Internal endpoint for public repo and event consumer (no auth required)
  @SkipThrottle()
  @Post('internal')
  @ApiOperation({
    summary: 'Create lead from contact form (internal)',
    description:
      'Internal endpoint for creating leads from public contact forms. No authentication required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'contact-123' },
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', example: 'john@example.com' },
        phone: { type: 'string', example: '+1234567890' },
        company: { type: 'string', example: 'Acme Inc' },
        message: { type: 'string', example: 'Interested in your services' },
        source: { type: 'string', example: 'contact-form' },
        page: { type: 'string', example: 'https://easuavez.com/pricing' },
        temperature: {
          type: 'string',
          enum: ['QUENTE', 'MORNO', 'FRIO'],
          example: 'MORNO',
          description: 'Lead priority: QUENTE (hot/red), MORNO (warm/green), FRIO (cold/blue). Defaults to MORNO.',
        },
      },
      required: ['id', 'name', 'email', 'source'],
    },
  })
  @ApiResponse({ status: 201, description: 'Lead created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createLeadFromContactFormInternal(
    @Body()
    contactFormData: {
      id: string;
      name: string;
      email: string;
      phone?: string;
      company?: string;
      message?: string;
      source: string;
      page?: string;
      temperature?: LeadTemperature;
    }
  ) {
    return await this.leadService.createLeadFromContactForm(contactFormData);
  }

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create lead from contact form',
    description: 'Create a lead from contact form submission. Requires authentication.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'contact-123' },
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', example: 'john@example.com' },
        phone: { type: 'string', example: '+1234567890' },
        company: { type: 'string', example: 'Acme Inc' },
        message: { type: 'string', example: 'Interested in your services' },
        source: { type: 'string', example: 'contact-form' },
        page: { type: 'string', example: 'https://easuavez.com/pricing' },
        temperature: {
          type: 'string',
          enum: ['QUENTE', 'MORNO', 'FRIO'],
          example: 'MORNO',
          description: 'Lead priority: QUENTE (hot/red), MORNO (warm/green), FRIO (cold/blue). Defaults to MORNO.',
        },
      },
      required: ['id', 'name', 'email', 'source'],
    },
  })
  @ApiResponse({ status: 201, description: 'Lead created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  public async createLeadFromContactForm(
    @Body()
    contactFormData: {
      id: string;
      name: string;
      email: string;
      phone?: string;
      company?: string;
      message?: string;
      source: string;
      page?: string;
      temperature?: LeadTemperature;
    },
    @User() user: any,
    @Request() request: any
  ) {
    const userId = user?.id || user?.userId || request?.userId;
    return await this.leadService.createLeadFromContactForm(
      contactFormData,
      userId,
      user?.businessId,
      user?.commerceId
    );
  }

  @Post('from-contact-form/:contactFormId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  public async createLeadFromContactFormId(
    @Param('contactFormId') contactFormId: string,
    @User() user: any,
    @Request() request: any
  ) {
    // This endpoint will be called to convert an existing contact form submission to a lead
    // First, we need to fetch the contact form data from query stack
    const userId = user?.id || user?.userId || request?.userId;
    return await this.leadService.createLeadFromContactFormId(contactFormId, userId);
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  public async getAllLeads(@User() user: any, @Request() request: any) {
    const userId = user?.id || user?.userId || request?.userId;
    return await this.leadService.getAllLeads(userId, user?.businessId, user?.commerceId);
  }

  @Get('stage/:stage')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  public async getLeadsByStage(
    @Param('stage') stage: LeadPipelineStage,
    @Query('userId') queryUserId?: string,
    @Query('businessId') queryBusinessId?: string,
    @Query('commerceId') queryCommerceId?: string,
    @User() user?: any,
    @Request() request?: any
  ) {
    // Get userId from query params first, then from user object or request
    // If queryUserId is explicitly provided (even if empty string), use it (convert empty to undefined)
    // Empty string means "explicitly don't filter by userId" (for master users)
    // If not provided in query params (undefined), fall back to user object
    let userId: string | undefined;
    if (queryUserId !== undefined) {
      // Query param was provided (even if empty string) - use it (empty string becomes undefined)
      userId = queryUserId && queryUserId.trim() !== '' ? queryUserId : undefined;
    } else {
      // Query param not provided - use value from user object (normal behavior)
      userId = user?.id || user?.userId || request?.userId;
    }

    // Same logic for businessId and commerceId
    // Empty string means "explicitly don't filter by this field"
    let businessId: string | undefined;
    if (queryBusinessId !== undefined) {
      businessId = queryBusinessId && queryBusinessId.trim() !== '' ? queryBusinessId : undefined;
    } else {
      businessId = user?.businessId;
    }

    let commerceId: string | undefined;
    if (queryCommerceId !== undefined) {
      commerceId = queryCommerceId && queryCommerceId.trim() !== '' ? queryCommerceId : undefined;
    } else {
      commerceId = user?.commerceId;
    }

    return await this.leadService.getLeadsByStage(
      stage,
      userId,
      businessId,
      commerceId
    );
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  public async getLeadById(@Param('id') id: string) {
    return await this.leadService.getLeadById(id);
  }

  @Put(':id/stage')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  public async updateLeadStage(
    @Param('id') id: string,
    @Body() body: { stage: LeadPipelineStage; status?: LeadStatus },
    @User() user: any,
    @Request() request: any
  ) {
    const userId = user?.id || user?.userId || request?.userId;
    return await this.leadService.updateLeadStage(id, body.stage, userId, body.status);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  public async updateLead(
    @Param('id') id: string,
    @Body() updates: Partial<any>,
    @User() user: any,
    @Request() request: any
  ) {
    const userId = user?.id || user?.userId || request?.userId;
    return await this.leadService.updateLead(id, updates, userId);
  }

  @Put(':id/assign')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  public async assignLead(
    @Param('id') id: string,
    @Body()
    body: {
      assignedToUserId: string;
      businessId?: string;
      commerceId?: string;
    },
    @User() user: any,
    @Request() request: any
  ) {
    const userId = user?.id || user?.userId || request?.userId;
    return await this.leadService.assignLead(
      id,
      body.assignedToUserId,
      userId,
      body.businessId || user?.businessId,
      body.commerceId || user?.commerceId
    );
  }

  @Post(':id/contact')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  public async addLeadContact(
    @Param('id') leadId: string,
    @Body()
    body: {
      type: LeadContactType;
      result: LeadContactResult;
      comment: string;
      scheduledAt?: Date;
    },
    @User() user: any,
    @Request() request: any
  ) {
    const userId = user?.id || user?.userId || request?.userId;
    return await this.leadService.addLeadContact(
      leadId,
      body.type,
      body.result,
      body.comment,
      userId,
      user?.businessId,
      user?.commerceId,
      user?.collaboratorId || userId,
      body.scheduledAt
    );
  }

  @Get(':id/contacts')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  public async getLeadContacts(@Param('id') leadId: string) {
    return await this.leadService.getLeadContacts(leadId);
  }
}
