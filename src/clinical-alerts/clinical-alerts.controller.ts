import { Body, Controller, Get, Post, Patch, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

import { ClinicalAlertsService } from './clinical-alerts.service';
import { ClinicalAlert, AlertType, AlertSeverity } from './model/clinical-alert.entity';

@ApiTags('clinical-alerts')
@Controller('clinical-alerts')
export class ClinicalAlertsController {
  constructor(private readonly alertsService: ClinicalAlertsService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @ApiOperation({
    summary: 'Create a clinical alert',
    description: 'Creates a new clinical alert',
  })
  @ApiBody({ type: Object })
  @ApiResponse({
    status: 201,
    description: 'Alert created successfully',
    type: ClinicalAlert,
  })
  async createAlert(
    @User() user,
    @Body()
    alertData: {
      commerceId: string;
      clientId: string;
      attentionId?: string;
      patientHistoryId?: string;
      type: AlertType;
      severity: AlertSeverity;
      title: string;
      message: string;
      details?: string;
      context?: any;
    }
  ): Promise<ClinicalAlert> {
    return this.alertsService.createAlert(user, alertData);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/client/:commerceId/:clientId')
  @ApiOperation({
    summary: 'Get alerts by client',
    description: 'Retrieves all alerts for a specific client',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID' })
  @ApiParam({ name: 'clientId', description: 'Client ID' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'List of alerts',
    type: [ClinicalAlert],
  })
  async getAlertsByClient(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string,
    @Query('activeOnly') activeOnly?: string
  ): Promise<ClinicalAlert[]> {
    const active = activeOnly !== 'false';
    return this.alertsService.getAlertsByClient(commerceId, clientId, active);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/attention/:commerceId/:attentionId')
  @ApiOperation({
    summary: 'Get alerts by attention',
    description: 'Retrieves all alerts for a specific attention',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID' })
  @ApiParam({ name: 'attentionId', description: 'Attention ID' })
  @ApiResponse({
    status: 200,
    description: 'List of alerts',
    type: [ClinicalAlert],
  })
  async getAlertsByAttention(
    @Param('commerceId') commerceId: string,
    @Param('attentionId') attentionId: string
  ): Promise<ClinicalAlert[]> {
    return this.alertsService.getAlertsByAttention(commerceId, attentionId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/acknowledge')
  @ApiOperation({
    summary: 'Acknowledge alert',
    description: 'Marks an alert as acknowledged',
  })
  @ApiParam({ name: 'id', description: 'Alert ID' })
  @ApiResponse({
    status: 200,
    description: 'Alert acknowledged successfully',
    type: ClinicalAlert,
  })
  async acknowledgeAlert(@User() user, @Param('id') id: string): Promise<ClinicalAlert> {
    return this.alertsService.acknowledgeAlert(user, id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/resolve')
  @ApiOperation({
    summary: 'Resolve alert',
    description: 'Marks an alert as resolved',
  })
  @ApiParam({ name: 'id', description: 'Alert ID' })
  @ApiResponse({
    status: 200,
    description: 'Alert resolved successfully',
    type: ClinicalAlert,
  })
  async resolveAlert(@User() user, @Param('id') id: string): Promise<ClinicalAlert> {
    return this.alertsService.resolveAlert(user, id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/validate/allergies')
  @ApiOperation({
    summary: 'Check allergies',
    description: 'Validates allergies for medications',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string' },
        medicationIds: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'List of allergy alerts',
    type: [ClinicalAlert],
  })
  async checkAllergies(
    @Body() body: { clientId: string; medicationIds: string[] }
  ): Promise<ClinicalAlert[]> {
    return this.alertsService.checkAllergies(body.clientId, body.medicationIds);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/validate/interactions')
  @ApiOperation({
    summary: 'Check drug interactions',
    description: 'Validates drug interactions',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string' },
        medicationIds: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'List of interaction alerts',
    type: [ClinicalAlert],
  })
  async checkInteractions(
    @Body() body: { clientId: string; medicationIds: string[] }
  ): Promise<ClinicalAlert[]> {
    return this.alertsService.checkDrugInteractions(body.clientId, body.medicationIds);
  }
}
