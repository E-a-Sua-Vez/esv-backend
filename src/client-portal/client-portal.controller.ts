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
import { ClientPortalAuthGuard } from './client-portal-auth.guard';
import { ClientPortalService } from './client-portal.service';
import { CommerceService } from '../commerce/commerce.service';
import { PermissionService } from '../permission/permission.service';

/**
 * Controlador do portal do cliente
 * Endpoints públicos e protegidos para acesso ao portal
 */
@ApiTags('client-portal')
@Controller('client-portal')
export class ClientPortalController {
  constructor(
    private readonly portalService: ClientPortalService,
    private readonly commerceService: CommerceService,
    private readonly permissionService: PermissionService
  ) {}

  // ========== ENDPOINTS PÚBLICOS ==========

  @Get('/commerce/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener información del comercio por slug (Público)',
    description: 'Obtiene la información pública del comercio usando su slug/keyName para el portal de clientes.',
  })
  @ApiParam({ name: 'slug', description: 'Slug/keyName del comercio', example: 'sempre-bela-morumbi' })
  @ApiResponse({
    status: 200,
    description: 'Información del comercio',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        keyName: { type: 'string' },
        tag: { type: 'string' },
        logo: { type: 'string' },
        email: { type: 'string' },
        active: { type: 'boolean' },
        available: { type: 'boolean' },
        category: { type: 'string' },
        localeInfo: { type: 'object' },
        contactInfo: { type: 'object' },
        serviceInfo: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Comercio no encontrado',
  })
  async getCommerceBySlug(@Param('slug') slug: string) {
    const commerce = await this.commerceService.getCommerceByKeyName(slug);

    if (!commerce) {
      throw new HttpException('Comércio não encontrado', HttpStatus.NOT_FOUND);
    }

    // Retornar solo información pública del comercio
    return {
      id: commerce.id,
      name: commerce.name,
      keyName: commerce.keyName,
      tag: commerce.tag,
      logo: commerce.logo,
      email: commerce.email,
      active: commerce.active,
      available: commerce.available,
      category: commerce.category,
      localeInfo: commerce.localeInfo,
      contactInfo: commerce.contactInfo,
      serviceInfo: commerce.serviceInfo,
    };
  }

  @Post('/:slug/request-access')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar código de acceso usando slug (Público)',
    description: 'Solicita un código de acceso al portal usando el slug del comercio. El código se envía por email/WhatsApp/SMS. Rate limited: 5 requests per minute per IP.',
  })
  @ApiParam({ name: 'slug', description: 'Slug/keyName del comercio', example: 'sempre-bela-morumbi' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        phone: { type: 'string' },
        idNumber: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Código enviado con éxito',
  })
  @ApiResponse({
    status: 404,
    description: 'Comercio no encontrado',
  })
  async requestAccessBySlug(
    @Param('slug') slug: string,
    @Body() body: { email?: string; phone?: string; idNumber?: string }
  ) {
    // Log para debugging
    console.log('🔵 requestAccessBySlug called with:', { slug, body });

    // Buscar comercio por slug
    const commerce = await this.commerceService.getCommerceByKeyName(slug);

    if (!commerce) {
      throw new HttpException('Comércio não encontrado', HttpStatus.NOT_FOUND);
    }

    console.log('✅ Commerce found:', commerce.id);

    // Filtrar valores vacíos y pasar undefined en lugar de strings vacías
    const email = body.email && body.email.trim() !== '' ? body.email : undefined;
    const phone = body.phone && body.phone.trim() !== '' ? body.phone : undefined;
    const idNumber = body.idNumber && body.idNumber.trim() !== '' ? body.idNumber : undefined;

    console.log('📤 Calling portalService.requestAccess with:', {
      commerceId: commerce.id,
      email,
      phone,
      idNumber
    });

    // Usar el commerceId para el método existente
    return this.portalService.requestAccess(
      commerce.id,
      email,
      phone,
      idNumber
    );
  }

  @Post('/:slug/validate-code')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar código de acceso usando slug (Público)',
    description: 'Valida el código de acceso y retorna token de sesión usando el slug del comercio. Rate limited: 10 requests per minute per IP.',
  })
  @ApiParam({ name: 'slug', description: 'Slug/keyName del comercio', example: 'sempre-bela-morumbi' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
      },
      required: ['code'],
    },
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
  @ApiResponse({
    status: 404,
    description: 'Comercio no encontrado',
  })
  async validateCodeBySlug(
    @Param('slug') slug: string,
    @Body() body: { code: string },
    @Req() req: any
  ) {
    // Buscar comercio por slug
    const commerce = await this.commerceService.getCommerceByKeyName(slug);

    if (!commerce) {
      throw new HttpException('Comércio não encontrado', HttpStatus.NOT_FOUND);
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
    const userAgent = req.headers['user-agent'];

    // Usar el commerceId para el método existente
    return this.portalService.validateCode(body.code, commerce.id, ipAddress, userAgent);
  }

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
        sentVia: { type: 'string', enum: ['EMAIL', 'WHATSAPP', 'SMS', 'EMAIL+WHATSAPP', 'EMAIL+SMS'] },
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

  @Get('/permissions/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener permisos del cliente (Protegido)',
    description: 'Obtiene los permisos del cliente basados en su rol, plan y configuraciones específicas. Valida el JWT directamente.',
  })
  @ApiParam({ name: 'token', description: 'Token JWT del cliente' })
  @ApiResponse({
    status: 200,
    description: 'Permisos del cliente',
    schema: {
      type: 'object',
      additionalProperties: {
        oneOf: [{ type: 'boolean' }, { type: 'number' }],
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Token inválido o expirado',
  })
  async getClientPermissions(@Param('token') token: string) {
    const jwt = require('jsonwebtoken');
    let payload;
    try {
      payload = jwt.verify(token, process.env.CLIENT_PORTAL_JWT_SECRET || 'client_portal_secret');
    } catch (err) {
      throw new HttpException('Token inválido o expirado', HttpStatus.UNAUTHORIZED);
    }
    // Obtener permisos usando el commerceId del payload
    const commerceId = payload.commerceId;
    // Si tienes permisos específicos del cliente, puedes obtenerlos aquí
    const clientPermissions = {};
    const permissions = await this.permissionService.getPermissionsForClient(
      commerceId,
      clientPermissions
    );
    return permissions;
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

    @UseGuards(ClientPortalAuthGuard)
    @Get('/consents/:commerceId/:clientId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
      summary: 'Obter consentimentos do cliente (Protegido)',
      description: 'Retorna todos os consentimentos do cliente para o portal. Requiere token JWT.',
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
      @Req() req: any
    ) {
      // El guard ya valida el token y pone el payload en req.clientPortal
      // Verificar que el cliente y comercio coincidan
      if (req.clientPortal.clientId !== clientId || req.clientPortal.commerceId !== commerceId) {
        throw new HttpException('Acesso negado', HttpStatus.FORBIDDEN);
      }
      return this.portalService.getClientConsents(commerceId, clientId);
    }


  @UseGuards(ClientPortalAuthGuard)
  @Patch('/consents/:consentId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revogar consentimento (Protegido)',
    description: 'Revoga um consentimento do cliente. Requiere token JWT.',
  })
  @ApiParam({ name: 'consentId', description: 'ID do consentimento' })
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
  })
  async revokeConsent(
    @Param('consentId') consentId: string,
    @Body() body: { reason?: string },
    @Req() req: any
  ) {
    // El guard ya valida el token y pone el payload en req.clientPortal
    return this.portalService.revokeConsent(consentId, req.clientPortal.clientId, body.reason);
  }


  @UseGuards(ClientPortalAuthGuard)
  @Get('/telemedicine/:commerceId/:clientId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter sessões de telemedicina do cliente (Protegido)',
    description: 'Retorna as sessões de telemedicina do cliente. Requiere token JWT.',
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
    @Req() req: any
  ) {
    if (req.clientPortal.clientId !== clientId || req.clientPortal.commerceId !== commerceId) {
      throw new HttpException('Acesso negado', HttpStatus.FORBIDDEN);
    }
    return this.portalService.getClientTelemedicineSessions(commerceId, clientId);
  }


  @UseGuards(ClientPortalAuthGuard)
  @Get('/profile/:commerceId/:clientId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter perfil do cliente (Protegido)',
    description: 'Retorna o perfil completo do cliente. Requiere token JWT.',
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
    @Req() req: any
  ) {
    if (req.clientPortal.clientId !== clientId || req.clientPortal.commerceId !== commerceId) {
      throw new HttpException('Acesso negado', HttpStatus.FORBIDDEN);
    }
    return this.portalService.getClientProfile(clientId);
  }


  @UseGuards(ClientPortalAuthGuard)
  @Get('/documents/:commerceId/:clientId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter documentos do cliente (Protegido)',
    description: 'Retorna os documentos do cliente. Requiere token JWT.',
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
    @Req() req: any
  ) {
    if (req.clientPortal.clientId !== clientId || req.clientPortal.commerceId !== commerceId) {
      throw new HttpException('Acesso negado', HttpStatus.FORBIDDEN);
    }
    return this.portalService.getClientDocuments(commerceId, clientId);
  }


  @UseGuards(ClientPortalAuthGuard)
  @Get('/attentions/:commerceId/:clientId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter histórico de atenções do cliente (Protegido)',
    description: 'Retorna o histórico de atenções do cliente. Requiere token JWT.',
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
    @Req() req: any
  ) {
    if (req.clientPortal.clientId !== clientId || req.clientPortal.commerceId !== commerceId) {
      throw new HttpException('Acesso negado', HttpStatus.FORBIDDEN);
    }
    return this.portalService.getClientAttentions(commerceId, clientId);
  }
}

