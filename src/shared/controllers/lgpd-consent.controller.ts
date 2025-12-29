import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { User } from '../../auth/user.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { LgpdConsentService } from '../services/lgpd-consent.service';
import { LgpdConsent, ConsentType, ConsentStatus } from '../model/lgpd-consent.entity';

/**
 * Controlador de consentimentos LGPD
 * Conformidade: LGPD (Lei 13.709/2018)
 */
@ApiTags('lgpd-consent')
@Controller('lgpd-consent')
export class LgpdConsentController {
  constructor(private readonly lgpdConsentService: LgpdConsentService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Criar ou atualizar consentimento LGPD',
    description: 'Cria um novo consentimento ou atualiza um existente',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string' },
        commerceId: { type: 'string' },
        consentType: { type: 'string', enum: Object.values(ConsentType) },
        status: { type: 'string', enum: Object.values(ConsentStatus) },
        purpose: { type: 'string' },
        description: { type: 'string' },
        legalBasis: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time' },
        consentMethod: { type: 'string', enum: ['WEB', 'MOBILE', 'PRESENTIAL', 'EMAIL', 'PHONE', 'OTHER'] },
        ipAddress: { type: 'string' },
        userAgent: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['clientId', 'commerceId', 'consentType', 'purpose'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Consentimento criado/atualizado com sucesso',
    type: LgpdConsent,
  })
  async createOrUpdateConsent(
    @User() user: any,
    @Body() consent: Partial<LgpdConsent>
  ): Promise<LgpdConsent> {
    return this.lgpdConsentService.createOrUpdateConsent(user.id || user.userId || user, {
      ...consent,
      ipAddress: consent.ipAddress,
      userAgent: consent.userAgent,
    });
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revogar consentimento LGPD',
    description: 'Revoga um consentimento ativo',
  })
  @ApiParam({ name: 'id', description: 'ID do consentimento' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Consentimento revogado com sucesso',
    type: LgpdConsent,
  })
  async revokeConsent(
    @User() user: any,
    @Param('id') id: string,
    @Body() body?: { reason?: string }
  ): Promise<LgpdConsent> {
    return this.lgpdConsentService.revokeConsent(user.id || user.userId || user, id, body?.reason);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/client/:commerceId/:clientId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter consentimentos de um cliente',
    description: 'Retorna todos os consentimentos de um cliente específico',
  })
  @ApiParam({ name: 'commerceId', description: 'ID do comércio' })
  @ApiParam({ name: 'clientId', description: 'ID do cliente' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean, description: 'Apenas consentimentos ativos' })
  @ApiResponse({
    status: 200,
    description: 'Lista de consentimentos',
    type: [LgpdConsent],
  })
  async getConsentsByClient(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string,
    @Query('activeOnly') activeOnly?: boolean
  ): Promise<LgpdConsent[]> {
    return this.lgpdConsentService.getConsentsByClient(
      commerceId,
      clientId,
      activeOnly !== false
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/check/:commerceId/:clientId/:consentType')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar se cliente tem consentimento ativo',
    description: 'Verifica se um cliente tem consentimento ativo para um tipo específico',
  })
  @ApiParam({ name: 'commerceId', description: 'ID do comércio' })
  @ApiParam({ name: 'clientId', description: 'ID do cliente' })
  @ApiParam({ name: 'consentType', description: 'Tipo de consentimento', enum: ConsentType })
  @ApiResponse({
    status: 200,
    description: 'Status do consentimento',
    schema: {
      type: 'object',
      properties: {
        hasConsent: { type: 'boolean' },
        consent: { type: 'object' },
      },
    },
  })
  async checkActiveConsent(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string,
    @Param('consentType') consentType: ConsentType
  ) {
    const hasConsent = await this.lgpdConsentService.hasActiveConsent(
      commerceId,
      clientId,
      consentType
    );

    let consent = null;
    if (hasConsent) {
      const consents = await this.lgpdConsentService.getConsentsByClient(
        commerceId,
        clientId,
        true
      );
      consent = consents.find(c => c.consentType === consentType && c.status === ConsentStatus.GRANTED);
    }

    return {
      hasConsent,
      consent,
    };
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter consentimento por ID',
    description: 'Retorna um consentimento específico',
  })
  @ApiParam({ name: 'id', description: 'ID do consentimento' })
  @ApiResponse({
    status: 200,
    description: 'Consentimento',
    type: LgpdConsent,
  })
  async getConsentById(@Param('id') id: string): Promise<LgpdConsent> {
    return this.lgpdConsentService.getConsentById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter todos os consentimentos',
    description: 'Retorna todos os consentimentos com filtros opcionais',
  })
  @ApiQuery({ name: 'commerceId', required: false, type: String })
  @ApiQuery({ name: 'clientId', required: false, type: String })
  @ApiQuery({ name: 'consentType', required: false, enum: ConsentType })
  @ApiQuery({ name: 'status', required: false, enum: ConsentStatus })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Lista de consentimentos',
    type: [LgpdConsent],
  })
  async getAllConsents(
    @Query('commerceId') commerceId?: string,
    @Query('clientId') clientId?: string,
    @Query('consentType') consentType?: ConsentType,
    @Query('status') status?: ConsentStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number
  ): Promise<LgpdConsent[]> {
    return this.lgpdConsentService.getAllConsents(
      {
        commerceId,
        clientId,
        consentType: consentType as ConsentType,
        status: status as ConsentStatus,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
      limit || 1000
    );
  }
}

