import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  HttpException,
  Req,
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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { User } from '../../auth/user.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { ConsentOrchestrationService } from '../services/consent-orchestration.service';
import {
  ConsentRequirement,
  ConsentRequestTiming,
} from '../model/consent-requirement.entity';
import { ConsentRequest, ConsentRequestStatus } from '../model/consent-request.entity';
import { ConsentType } from '../model/lgpd-consent.entity';

/**
 * Controlador de orquestación de consentimientos LGPD
 * Gestiona la solicitud y procesamiento de consentimientos
 */
@ApiTags('consent-orchestration')
@Controller('consent-orchestration')
export class ConsentOrchestrationController {
  constructor(
    private readonly orchestrationService: ConsentOrchestrationService
  ) {}

  // ========== ENDPOINTS PÚBLICOS (Sin autenticación) ==========

  @Get('/requests/validate-token/:token')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute per IP
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar token de consentimiento (Público)',
    description: 'Valida un token de solicitud de consentimiento. Endpoint público para el formulario web. Rate limited: 20 requests per minute per IP.',
  })
  @ApiParam({ name: 'token', description: 'Token de la solicitud', example: 'abc123def456' })
  @ApiResponse({
    status: 200,
    description: 'Token válido',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
        expired: { type: 'boolean', example: false },
        request: { type: 'object' },
        commerce: { type: 'object' },
        client: { type: 'object' },
        requirements: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests - Rate limit exceeded',
  })
  async validateToken(@Param('token') token: string) {
    return this.orchestrationService.validateConsentToken(token);
  }

  @Post('/requests/process-response/:token')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute per IP
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Procesar respuesta de consentimiento (Público)',
    description: 'Procesa las respuestas del cliente desde el formulario web. Endpoint público. Rate limited: 10 requests per minute per IP.',
  })
  @ApiParam({ name: 'token', description: 'Token de la solicitud', example: 'abc123def456' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        responses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              consentType: { type: 'string', enum: Object.values(ConsentType), example: 'DATA_PROCESSING' },
              granted: { type: 'boolean', example: true },
              notes: { type: 'string', example: 'Cliente acepta el procesamiento de datos' },
            },
            required: ['consentType', 'granted'],
          },
        },
      },
      required: ['responses'],
      example: {
        responses: [
          { consentType: 'DATA_PROCESSING', granted: true },
          { consentType: 'MARKETING', granted: false, notes: 'Cliente no desea recibir marketing' },
        ],
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Respuesta procesada con éxito',
    type: ConsentRequest,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Token inválido o respuestas mal formadas',
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests - Rate limit exceeded',
  })
  async processResponse(
    @Param('token') token: string,
    @Body() body: { responses: Array<{ consentType: ConsentType; granted: boolean; notes?: string }> },
    @Req() req: any
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
    const userAgent = req.headers['user-agent'];
    return this.orchestrationService.processConsentResponse(
      token,
      body.responses,
      ipAddress,
      userAgent
    );
  }

  // ========== ENDPOINTS PROTEGIDOS ==========

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/requirements/:commerceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener requisitos de consentimiento de un comercio',
    description: 'Retorna todos los requisitos de consentimiento activos para un comercio',
  })
  @ApiParam({ name: 'commerceId', description: 'ID del comercio' })
  @ApiResponse({
    status: 200,
    description: 'Lista de requisitos',
    type: [ConsentRequirement],
  })
  async getRequirements(@Param('commerceId') commerceId: string): Promise<ConsentRequirement[]> {
    return this.orchestrationService.getRequirementsByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/requirements')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear requisito de consentimiento',
    description: 'Crea un nuevo requisito de consentimiento para un comercio',
  })
  @ApiBody({ type: ConsentRequirement })
  @ApiResponse({
    status: 201,
    description: 'Requisito creado con éxito',
    type: ConsentRequirement,
  })
  async createRequirement(
    @User() user: any,
    @Body() body: { commerceId: string; requirement: Partial<ConsentRequirement> }
  ): Promise<ConsentRequirement> {
    const userId = user.id || user.userId || user;
    return this.orchestrationService.createRequirement(
      body.commerceId,
      body.requirement,
      userId
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/requirements/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar requisito de consentimiento',
    description: 'Actualiza un requisito de consentimiento existente',
  })
  @ApiParam({ name: 'id', description: 'ID del requisito' })
  @ApiResponse({
    status: 200,
    description: 'Requisito actualizado con éxito',
    type: ConsentRequirement,
  })
  async updateRequirement(
    @User() user: any,
    @Param('id') id: string,
    @Body() body: { requirement: Partial<ConsentRequirement> }
  ): Promise<ConsentRequirement> {
    const userId = user.id || user.userId || user;
    return this.orchestrationService.updateRequirement(id, body.requirement, userId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete('/requirements/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar requisito de consentimiento',
    description: 'Elimina (desactiva) un requisito de consentimiento',
  })
  @ApiParam({ name: 'id', description: 'ID del requisito' })
  @ApiResponse({
    status: 204,
    description: 'Requisito eliminado con éxito',
  })
  async deleteRequirement(@User() user: any, @Param('id') id: string): Promise<void> {
    const userId = user.id || user.userId || user;
    return this.orchestrationService.deleteRequirement(id, userId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/missing/:commerceId/:clientId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener consentimientos faltantes',
    description: 'Retorna los consentimientos que faltan para un cliente',
  })
  @ApiParam({ name: 'commerceId', description: 'ID del comercio' })
  @ApiParam({ name: 'clientId', description: 'ID del cliente' })
  @ApiResponse({
    status: 200,
    description: 'Lista de consentimientos faltantes',
    type: [ConsentRequirement],
  })
  async getMissingConsents(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string
  ): Promise<ConsentRequirement[]> {
    return this.orchestrationService.getMissingConsents(commerceId, clientId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/requests/request-all')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Solicitar todos los consentimientos pendientes',
    description: 'Crea una solicitud para todos los consentimientos pendientes de un cliente',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        commerceId: { type: 'string' },
        clientId: { type: 'string' },
        timing: { type: 'string', enum: Object.values(ConsentRequestTiming) },
      },
      required: ['commerceId', 'clientId', 'timing'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Solicitud creada con éxito',
    type: ConsentRequest,
  })
  async requestAllPending(
    @User() user: any,
    @Body() body: {
      commerceId: string;
      clientId: string;
      timing: ConsentRequestTiming;
    }
  ): Promise<ConsentRequest | null> {
    const userId = user.id || user.userId || user;
    return this.orchestrationService.requestAllPendingConsents(
      body.commerceId,
      body.clientId,
      body.timing,
      userId
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/requests/:commerceId/:clientId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener solicitudes de consentimiento de un cliente',
    description: 'Retorna todas las solicitudes de consentimiento para un cliente',
  })
  @ApiParam({ name: 'commerceId', description: 'ID del comercio' })
  @ApiParam({ name: 'clientId', description: 'ID del cliente' })
  @ApiResponse({
    status: 200,
    description: 'Lista de solicitudes',
    type: [ConsentRequest],
  })
  async getRequests(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string
  ): Promise<ConsentRequest[]> {
    // TODO: Implementar obtención de solicitudes
    throw new HttpException('Not implemented yet', HttpStatus.NOT_IMPLEMENTED);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/status/:commerceId/:clientId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener estado consolidado de consentimientos',
    description: 'Retorna el estado completo de consentimientos para un cliente',
  })
  @ApiParam({ name: 'commerceId', description: 'ID del comercio' })
  @ApiParam({ name: 'clientId', description: 'ID del cliente' })
  @ApiResponse({
    status: 200,
    description: 'Estado consolidado de consentimientos',
    schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string' },
        commerceId: { type: 'string' },
        consents: { type: 'array' },
        requirements: { type: 'array' },
        missing: { type: 'array' },
        summary: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            granted: { type: 'number' },
            pending: { type: 'number' },
            denied: { type: 'number' },
            expired: { type: 'number' },
            revoked: { type: 'number' },
          },
        },
      },
    },
  })
  async getConsentStatus(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string
  ) {
    return this.orchestrationService.getConsentStatus(commerceId, clientId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/requests/:requestId/qrcode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener QR Code de una solicitud de consentimiento',
    description: 'Retorna el QR Code (base64) de una solicitud de consentimiento. Si no existe, lo genera.',
  })
  @ApiParam({ name: 'requestId', description: 'ID de la solicitud' })
  @ApiResponse({
    status: 200,
    description: 'QR Code generado',
    schema: {
      type: 'object',
      properties: {
        qrCodeUrl: { type: 'string', description: 'Data URL completo (data:image/png;base64,...)' },
        qrCodeBase64: { type: 'string', description: 'Base64 sin prefijo' },
        link: { type: 'string', description: 'Link codificado no QR Code' },
      },
    },
  })
  async getRequestQRCode(@Param('requestId') requestId: string) {
    return this.orchestrationService.getRequestQRCode(requestId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/compliance-metrics/:commerceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener métricas agregadas de compliance LGPD',
    description: 'Retorna métricas agregadas de compliance para un comercio',
  })
  @ApiParam({ name: 'commerceId', description: 'ID del comercio' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Fecha de inicio (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Fecha de fin (ISO string)' })
  @ApiResponse({
    status: 200,
    description: 'Métricas de compliance',
    schema: {
      type: 'object',
      properties: {
        totalClients: { type: 'number' },
        clientsWithAllConsents: { type: 'number' },
        clientsWithPendingConsents: { type: 'number' },
        clientsWithExpiredConsents: { type: 'number' },
        totalConsents: { type: 'number' },
        grantedConsents: { type: 'number' },
        pendingConsents: { type: 'number' },
        deniedConsents: { type: 'number' },
        expiredConsents: { type: 'number' },
        revokedConsents: { type: 'number' },
        complianceScore: { type: 'number' },
        blockingConsents: { type: 'number' },
      },
    },
  })
  async getComplianceMetrics(
    @Param('commerceId') commerceId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.orchestrationService.getComplianceMetrics(
      commerceId,
      startDate,
      endDate ? new Date(endDate) : undefined
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/notification-metrics/:commerceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener métricas de notificaciones de consentimiento LGPD',
    description: 'Retorna métricas agregadas de notificaciones enviadas para solicitudes de consentimiento',
  })
  @ApiParam({ name: 'commerceId', description: 'ID del comercio' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Fecha de inicio (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Fecha de fin (ISO string)' })
  @ApiResponse({
    status: 200,
    description: 'Métricas de notificaciones',
    schema: {
      type: 'object',
      properties: {
        totalSent: { type: 'number' },
        byChannel: {
          type: 'object',
          properties: {
            email: { type: 'number' },
            whatsapp: { type: 'number' },
            sms: { type: 'number' },
            push: { type: 'number' },
            inApp: { type: 'number' },
          },
        },
        byStatus: {
          type: 'object',
          properties: {
            sent: { type: 'number' },
            delivered: { type: 'number' },
            failed: { type: 'number' },
            pending: { type: 'number' },
          },
        },
        successRate: { type: 'number' },
        dailyBreakdown: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getNotificationMetrics(
    @Param('commerceId') commerceId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.orchestrationService.getNotificationMetrics(
      commerceId,
      startDate,
      endDate ? new Date(endDate) : undefined
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/requirements/:requirementId/versions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter histórico de versões de um requisito',
    description: 'Retorna todas as versões de um requisito de consentimento',
  })
  @ApiParam({ name: 'requirementId', description: 'ID do requisito' })
  @ApiResponse({
    status: 200,
    description: 'Lista de versões',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          requirementId: { type: 'string' },
          version: { type: 'number' },
          action: { type: 'string', enum: ['CREATE', 'UPDATE', 'DELETE'] },
          changedBy: { type: 'string' },
          changedAt: { type: 'string', format: 'date-time' },
          changedFields: { type: 'array', items: { type: 'string' } },
          changeDescription: { type: 'string' },
        },
      },
    },
  })
  async getRequirementVersions(@Param('requirementId') requirementId: string) {
    return this.orchestrationService.getRequirementVersions(requirementId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/requirements/:requirementId/versions/:version')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter uma versão específica de um requisito',
    description: 'Retorna o snapshot completo de uma versão específica',
  })
  @ApiParam({ name: 'requirementId', description: 'ID do requisito' })
  @ApiParam({ name: 'version', description: 'Número da versão', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Versão do requisito',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        requirementId: { type: 'string' },
        version: { type: 'number' },
        snapshot: { type: 'object' },
        action: { type: 'string' },
        changedBy: { type: 'string' },
        changedAt: { type: 'string', format: 'date-time' },
        changedFields: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async getRequirementVersion(
    @Param('requirementId') requirementId: string,
    @Param('version') version: number
  ) {
    return this.orchestrationService.getRequirementVersion(requirementId, version);
  }
}

