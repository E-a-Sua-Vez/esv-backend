import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  Query,
  HttpCode,
  HttpStatus,
  HttpException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { AuthGuard } from '../auth/auth.guard';
import { ClientPortalService } from './client-portal.service';

/**
 * Controlador do portal do cliente
 * Endpoints públicos e protegidos para acesso ao portal
 */
@ApiTags('client-portal')
@Controller('client-portal')
export class ClientPortalController {
  constructor(private readonly portalService: ClientPortalService) {}

  // ========== ENDPOINTS PÚBLICOS ==========

  @Post('/request-access')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute per IP
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar código de acesso ao portal (Público)',
    description: 'Solicita um código de acesso ao portal do cliente. O código é enviado por email/WhatsApp/SMS. Rate limited: 5 requests per minute per IP.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        commerceId: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        idNumber: { type: 'string' },
      },
      required: ['commerceId'],
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests - Rate limit exceeded',
  })
  @ApiResponse({
    status: 200,
    description: 'Código enviado com sucesso',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Código gerado (apenas para debug)' },
        expiresAt: { type: 'string', format: 'date-time' },
        sentVia: { type: 'string', enum: ['EMAIL', 'WHATSAPP', 'SMS'] },
      },
    },
  })
  async requestAccess(
    @Body() body: { commerceId: string; email?: string; phone?: string; idNumber?: string }
  ) {
    return this.portalService.requestAccess(
      body.commerceId,
      body.email,
      body.phone,
      body.idNumber
    );
  }

  @Post('/validate-code')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute per IP
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar código de acesso (Público)',
    description: 'Valida o código de acesso e retorna token de sessão. Rate limited: 10 requests per minute per IP.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        commerceId: { type: 'string' },
      },
      required: ['code', 'commerceId'],
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests - Rate limit exceeded',
  })
  @ApiResponse({
    status: 200,
    description: 'Código válido',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        sessionToken: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time' },
        client: { type: 'object' },
        commerce: { type: 'object' },
      },
    },
  })
  async validateCode(
    @Body() body: { code: string; commerceId: string },
    @Req() req: any
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
    const userAgent = req.headers['user-agent'];
    return this.portalService.validateCode(body.code, body.commerceId, ipAddress, userAgent);
  }

  @Get('/session/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar token de sessão (Público)',
    description: 'Valida um token de sessão e retorna informações do cliente e comércio.',
  })
  @ApiParam({ name: 'token', description: 'Token de sessão' })
  @ApiResponse({
    status: 200,
    description: 'Token válido',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        expired: { type: 'boolean' },
        session: { type: 'object' },
        client: { type: 'object' },
        commerce: { type: 'object' },
      },
    },
  })
  async validateSession(@Param('token') token: string) {
    return this.portalService.validateSession(token);
  }

  @Post('/session/:token/renew')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renovar sessão (Público)',
    description: 'Renova uma sessão expirada ou próxima de expirar.',
  })
  @ApiParam({ name: 'token', description: 'Token de sessão atual' })
  @ApiResponse({
    status: 200,
    description: 'Sessão renovada',
    schema: {
      type: 'object',
      properties: {
        newToken: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async renewSession(@Param('token') token: string) {
    return this.portalService.renewSession(token);
  }

  // ========== ENDPOINTS PROTEGIDOS (para uso futuro) ==========

  @Get('/consents/:commerceId/:clientId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter consentimentos do cliente (Público via sessão)',
    description: 'Retorna todos os consentimentos do cliente para o portal. Valida sessão via token.',
  })
  @ApiParam({ name: 'commerceId', description: 'ID do comércio' })
  @ApiParam({ name: 'clientId', description: 'ID do cliente' })
  @ApiResponse({
    status: 200,
    description: 'Status dos consentimentos',
    schema: {
      type: 'object',
      properties: {
        consents: { type: 'array' },
        summary: { type: 'object' },
      },
    },
  })
  async getClientConsents(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string,
    @Query('token') token?: string,
    @Req() req?: any
  ) {
    // Validar token de sessão do header ou query
    const sessionToken = token || req?.headers?.['x-portal-token'] || req?.query?.token;
    if (!sessionToken) {
      throw new HttpException('Token de sessão requerido', HttpStatus.UNAUTHORIZED);
    }

    const session = await this.portalService.validateSession(sessionToken);
    if (!session.valid || session.expired) {
      throw new HttpException('Sessão inválida ou expirada', HttpStatus.UNAUTHORIZED);
    }

    // Verificar se o cliente da sessão corresponde ao solicitado
    if (session.client?.id !== clientId || session.commerce?.id !== commerceId) {
      throw new HttpException('Acesso negado', HttpStatus.FORBIDDEN);
    }

    // Buscar status dos consentimentos via ConsentOrchestrationService
    return this.portalService.getClientConsents(commerceId, clientId);
  }

  @Patch('/consents/:consentId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revogar consentimento (Público via sessão)',
    description: 'Revoga um consentimento do cliente. Valida sessão via token.',
  })
  @ApiParam({ name: 'consentId', description: 'ID do consentimento' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
        token: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Consentimento revogado com sucesso',
  })
  async revokeConsent(
    @Param('consentId') consentId: string,
    @Body() body: { reason?: string; token?: string },
    @Query('token') queryToken?: string,
    @Req() req?: any
  ) {
    // Validar token de sessão
    const sessionToken = body.token || queryToken || req?.headers?.['x-portal-token'] || req?.query?.token;
    if (!sessionToken) {
      throw new HttpException('Token de sessão requerido', HttpStatus.UNAUTHORIZED);
    }

    const session = await this.portalService.validateSession(sessionToken);
    if (!session.valid || session.expired) {
      throw new HttpException('Sessão inválida ou expirada', HttpStatus.UNAUTHORIZED);
    }

    // Revogar consentimento via ClientPortalService
    return this.portalService.revokeConsent(consentId, session.client.id, body.reason);
  }

  @Get('/telemedicine/:commerceId/:clientId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter sessões de telemedicina do cliente (Público via sessão)',
    description: 'Retorna as sessões de telemedicina do cliente. Valida sessão via token.',
  })
  @ApiParam({ name: 'commerceId', description: 'ID do comércio' })
  @ApiParam({ name: 'clientId', description: 'ID do cliente' })
  @ApiResponse({
    status: 200,
    description: 'Lista de sessões de telemedicina',
    schema: {
      type: 'array',
      items: {
        type: 'object',
      },
    },
  })
  async getTelemedicineSessions(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string,
    @Query('token') token?: string,
    @Req() req?: any
  ) {
    // Validar token de sessão
    const sessionToken = token || req?.headers?.['x-portal-token'] || req?.query?.token;
    if (!sessionToken) {
      throw new HttpException('Token de sessão requerido', HttpStatus.UNAUTHORIZED);
    }

    const session = await this.portalService.validateSession(sessionToken);
    if (!session.valid || session.expired) {
      throw new HttpException('Sessão inválida ou expirada', HttpStatus.UNAUTHORIZED);
    }

    // Verificar se o cliente da sessão corresponde ao solicitado
    if (session.client?.id !== clientId || session.commerce?.id !== commerceId) {
      throw new HttpException('Acesso negado', HttpStatus.FORBIDDEN);
    }

    // Buscar sessões de telemedicina
    return this.portalService.getClientTelemedicineSessions(commerceId, clientId);
  }

  @Get('/profile/:commerceId/:clientId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter perfil do cliente (Público via sessão)',
    description: 'Retorna o perfil completo do cliente. Valida sessão via token.',
  })
  @ApiParam({ name: 'commerceId', description: 'ID do comércio' })
  @ApiParam({ name: 'clientId', description: 'ID do cliente' })
  @ApiResponse({
    status: 200,
    description: 'Perfil do cliente',
    schema: {
      type: 'object',
    },
  })
  async getClientProfile(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string,
    @Query('token') token?: string,
    @Req() req?: any
  ) {
    // Validar token de sessão
    const sessionToken = token || req?.headers?.['x-portal-token'] || req?.query?.token;
    if (!sessionToken) {
      throw new HttpException('Token de sessão requerido', HttpStatus.UNAUTHORIZED);
    }

    const session = await this.portalService.validateSession(sessionToken);
    if (!session.valid || session.expired) {
      throw new HttpException('Sessão inválida ou expirada', HttpStatus.UNAUTHORIZED);
    }

    // Verificar se o cliente da sessão corresponde ao solicitado
    if (session.client?.id !== clientId || session.commerce?.id !== commerceId) {
      throw new HttpException('Acesso negado', HttpStatus.FORBIDDEN);
    }

    // Buscar perfil do cliente
    return this.portalService.getClientProfile(clientId);
  }

  @Get('/documents/:commerceId/:clientId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter documentos do cliente (Público via sessão)',
    description: 'Retorna os documentos do cliente. Valida sessão via token.',
  })
  @ApiParam({ name: 'commerceId', description: 'ID do comércio' })
  @ApiParam({ name: 'clientId', description: 'ID do cliente' })
  @ApiResponse({
    status: 200,
    description: 'Lista de documentos',
    schema: {
      type: 'array',
      items: {
        type: 'object',
      },
    },
  })
  async getClientDocuments(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string,
    @Query('token') token?: string,
    @Req() req?: any
  ) {
    // Validar token de sessão
    const sessionToken = token || req?.headers?.['x-portal-token'] || req?.query?.token;
    if (!sessionToken) {
      throw new HttpException('Token de sessão requerido', HttpStatus.UNAUTHORIZED);
    }

    const session = await this.portalService.validateSession(sessionToken);
    if (!session.valid || session.expired) {
      throw new HttpException('Sessão inválida ou expirada', HttpStatus.UNAUTHORIZED);
    }

    // Verificar se o cliente da sessão corresponde ao solicitado
    if (session.client?.id !== clientId || session.commerce?.id !== commerceId) {
      throw new HttpException('Acesso negado', HttpStatus.FORBIDDEN);
    }

    // Buscar documentos do cliente
    return this.portalService.getClientDocuments(commerceId, clientId);
  }

  @Get('/attentions/:commerceId/:clientId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter histórico de atenções do cliente (Público via sessão)',
    description: 'Retorna o histórico de atenções do cliente. Valida sessão via token.',
  })
  @ApiParam({ name: 'commerceId', description: 'ID do comércio' })
  @ApiParam({ name: 'clientId', description: 'ID do cliente' })
  @ApiResponse({
    status: 200,
    description: 'Lista de atenções',
    schema: {
      type: 'array',
      items: {
        type: 'object',
      },
    },
  })
  async getClientAttentions(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string,
    @Query('token') token?: string,
    @Req() req?: any
  ) {
    // Validar token de sessão
    const sessionToken = token || req?.headers?.['x-portal-token'] || req?.query?.token;
    if (!sessionToken) {
      throw new HttpException('Token de sessão requerido', HttpStatus.UNAUTHORIZED);
    }

    const session = await this.portalService.validateSession(sessionToken);
    if (!session.valid || session.expired) {
      throw new HttpException('Sessão inválida ou expirada', HttpStatus.UNAUTHORIZED);
    }

    // Verificar se o cliente da sessão corresponde ao solicitado
    if (session.client?.id !== clientId || session.commerce?.id !== commerceId) {
      throw new HttpException('Acesso negado', HttpStatus.FORBIDDEN);
    }

    // Buscar histórico de atenções
    return this.portalService.getClientAttentions(commerceId, clientId);
  }
}

