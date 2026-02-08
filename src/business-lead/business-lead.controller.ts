import { Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/user.decorator';
import { LeadContactResult } from '../lead/model/lead-contact-result.enum';
import { LeadContactType } from '../lead/model/lead-contact-type.enum';
import { LeadPipelineStage } from '../lead/model/lead-pipeline-stage.enum';
import { LeadStatus } from '../lead/model/lead-status.enum';
import { LeadTemperature } from '../lead/model/lead-temperature.enum';

import { BusinessLeadService } from './business-lead.service';

@ApiTags('business-lead')
@Controller('business-lead')
export class BusinessLeadController {
  constructor(private businessLeadService: BusinessLeadService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create new business lead',
    description: 'Creates a new lead for a business/commerce',
  })
  public async createBusinessLead(
    @Body()
    body: {
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
      businessId: string;
      commerceId: string;
    },
    @User() user: any,
    @Request() request: any
  ) {
    const userId = user?.id || user?.userId || request?.userId;
    const collaboratorId = user?.collaboratorId;

    return await this.businessLeadService.createBusinessLead(
      body,
      body.businessId,
      body.commerceId,
      userId,
      collaboratorId
    );
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all business leads with filters',
    description: 'Returns all business leads filtered by business, commerce, or collaborator',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiQuery({ name: 'commerceId', required: false })
  @ApiQuery({ name: 'collaboratorId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  public async getAllBusinessLeads(
    @Query('businessId') businessId?: string,
    @Query('commerceId') commerceId?: string,
    @Query('collaboratorId') collaboratorId?: string,
    @Query('userId') queryUserId?: string,
    @User() user?: any,
    @Request() request?: any
  ) {
    const userId = queryUserId || user?.id || user?.userId || request?.userId;

    return await this.businessLeadService.getAllBusinessLeads(
      businessId,
      commerceId,
      collaboratorId,
      userId
    );
  }

  @Get('stage/:stage')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get business leads by pipeline stage',
    description: 'Returns business leads in a specific pipeline stage with filters',
  })
  @ApiParam({ name: 'stage', enum: LeadPipelineStage })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiQuery({ name: 'commerceId', required: false })
  @ApiQuery({ name: 'collaboratorId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  public async getBusinessLeadsByStage(
    @Param('stage') stage: LeadPipelineStage,
    @Query('businessId') businessId?: string,
    @Query('commerceId') commerceId?: string,
    @Query('collaboratorId') collaboratorId?: string,
    @Query('userId') queryUserId?: string,
    @User() user?: any,
    @Request() request?: any
  ) {
    const userId = queryUserId || user?.id || user?.userId || request?.userId;

    return await this.businessLeadService.getBusinessLeadsByStage(
      stage,
      businessId,
      commerceId,
      collaboratorId,
      userId
    );
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get business lead by ID',
    description: 'Returns a specific business lead',
  })
  @ApiParam({ name: 'id', description: 'Business Lead ID' })
  public async getBusinessLeadById(@Param('id') id: string) {
    return await this.businessLeadService.getBusinessLeadById(id);
  }

  @Put(':id/stage')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update business lead pipeline stage',
    description: 'Moves a business lead to a different pipeline stage',
  })
  @ApiParam({ name: 'id', description: 'Business Lead ID' })
  public async updateBusinessLeadStage(
    @Param('id') id: string,
    @Body() body: { stage: LeadPipelineStage; status?: LeadStatus },
    @User() user: any,
    @Request() request: any
  ) {
    const userId = user?.id || user?.userId || request?.userId;
    const collaboratorId = user?.collaboratorId;

    return await this.businessLeadService.updateBusinessLeadStage(
      id,
      body.stage,
      userId,
      body.status,
      collaboratorId
    );
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update business lead',
    description: 'Updates business lead information',
  })
  @ApiParam({ name: 'id', description: 'Business Lead ID' })
  public async updateBusinessLead(
    @Param('id') id: string,
    @Body() updates: Partial<any>,
    @User() user: any,
    @Request() request: any
  ) {
    const userId = user?.id || user?.userId || request?.userId;
    const collaboratorId = user?.collaboratorId;

    return await this.businessLeadService.updateBusinessLead(id, updates, userId, collaboratorId);
  }

  @Post(':id/contact')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Add contact to business lead',
    description: 'Records a contact attempt with a business lead',
  })
  @ApiParam({ name: 'id', description: 'Business Lead ID' })
  public async addBusinessLeadContact(
    @Param('id') id: string,
    @Body()
    body: {
      type: LeadContactType;
      result: LeadContactResult;
      comment: string;
    },
    @User() user: any,
    @Request() request: any
  ) {
    const userId = user?.id || user?.userId || request?.userId;
    const collaboratorId = user?.collaboratorId;

    return await this.businessLeadService.addBusinessLeadContact(
      id,
      body.type,
      body.result,
      body.comment,
      userId,
      collaboratorId
    );
  }

  @Get(':id/contacts')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get business lead contacts',
    description: 'Returns all contact history for a business lead',
  })
  @ApiParam({ name: 'id', description: 'Business Lead ID' })
  public async getBusinessLeadContacts(@Param('id') id: string) {
    return await this.businessLeadService.getBusinessLeadContacts(id);
  }

  @Post(':id/convert')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Convert business lead to client',
    description: 'Converts a business lead into a client with bidirectional reference',
  })
  @ApiParam({ name: 'id', description: 'Business Lead ID' })
  public async convertBusinessLeadToClient(
    @Param('id') id: string,
    @User() user: any,
    @Request() request: any
  ) {
    const userId = user?.id || user?.userId || request?.userId;
    const collaboratorId = user?.collaboratorId;

    return await this.businessLeadService.convertBusinessLeadToClient(id, userId, collaboratorId);
  }
}
