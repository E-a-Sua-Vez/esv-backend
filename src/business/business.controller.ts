import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';
import { PermissionService } from '../permission/permission.service';

import { BusinessService } from './business.service';
import { BusinessKeyNameDetailsDto } from './dto/business-keyname-details.dto';
import { Business, WhatsappConnection } from './model/business.entity';

@ApiTags('business')
@Controller('business')
export class BusinessController {
  constructor(
    private readonly businessService: BusinessService,
    private readonly permissionService: PermissionService
  ) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get business by ID',
    description: 'Retrieves a business by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Business ID', example: 'business-123' })
  @ApiResponse({ status: 200, description: 'Business found', type: Business })
  @ApiResponse({ status: 404, description: 'Business not found' })
  public async getBusinessById(@Param() params: any): Promise<Business> {
    const { id } = params;
    return this.businessService.getBusinessById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/keyName/:keyName')
  @ApiOperation({
    summary: 'Get business by key name',
    description: 'Retrieves a business by its unique key name',
  })
  @ApiParam({ name: 'keyName', description: 'Business key name', example: 'my-business' })
  @ApiResponse({ status: 200, description: 'Business found', type: BusinessKeyNameDetailsDto })
  public async getBusinessByKeyName(@Param() params: any): Promise<BusinessKeyNameDetailsDto> {
    const { keyName } = params;
    return this.businessService.getBusinessByKeyName(keyName);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({
    summary: 'Get all businesses',
    description: 'Retrieves a list of all businesses',
  })
  @ApiResponse({ status: 200, description: 'List of businesses', type: [Business] })
  public async getBusiness(): Promise<Business[]> {
    return this.businessService.getBusinesses();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new business', description: 'Creates a new business account' })
  @ApiBody({ type: Business })
  @ApiResponse({ status: 201, description: 'Business created successfully', type: Business })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createBusiness(@User() user, @Body() body: Business): Promise<Business> {
    const {
      name,
      keyName,
      country,
      email,
      logo,
      phone,
      url,
      category,
      localeInfo,
      contactInfo,
      serviceInfo,
      partnerId,
    } = body;
    return this.businessService.createBusiness(
      user,
      name,
      keyName,
      country,
      email,
      logo,
      phone,
      url,
      category,
      localeInfo,
      contactInfo,
      serviceInfo,
      partnerId
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({ summary: 'Update business', description: 'Updates an existing business' })
  @ApiParam({ name: 'id', description: 'Business ID', example: 'business-123' })
  @ApiBody({ type: Business })
  @ApiResponse({ status: 200, description: 'Business updated successfully', type: Business })
  @ApiResponse({ status: 404, description: 'Business not found' })
  public async updateBusiness(
    @User() user,
    @Param() params: any,
    @Body() body: Business
  ): Promise<Business> {
    const { id } = params;
    const { logo, phone, url, active, category, localeInfo, contactInfo, serviceInfo, partnerId } =
      body;
    return this.businessService.updateBusiness(
      user,
      id,
      logo,
      phone,
      url,
      active,
      category,
      localeInfo,
      contactInfo,
      serviceInfo,
      partnerId
    );
  }

  @UseGuards(AuthGuard)
  @Get('/:id/whatsapp-connection')
  public async getWhatsappConnectionById(@Param() params: any): Promise<WhatsappConnection> {
    const { id } = params;
    return this.businessService.getWhatsappConnectionById(id);
  }

  @UseGuards(AuthGuard)
  @Patch('/:id/whatsapp-connection')
  public async updateWhatsappConnection(
    @User() user,
    @Param() params: any,
    @Body() body: WhatsappConnection
  ): Promise<Business> {
    const { id } = params;
    const { idConnection, whatsapp } = body;
    return this.businessService.updateWhatsappConnection(user, id, idConnection, whatsapp);
  }

  @UseGuards(AuthGuard)
  @Post('/:id/resquest/whatsapp-connection/:whatsapp')
  public async requestWhatsappConnectionById(
    @User() user,
    @Param() params: any
  ): Promise<Business> {
    const { id, whatsapp } = params;
    return this.businessService.requestWhatsappConnectionById(user, id, whatsapp);
  }

  @UseGuards(AuthGuard)
  @Post('/:id/return/whatsapp-connection/:instanceId')
  public async returnWhatsappConnectionById(@User() user, @Param() params: any): Promise<Business> {
    const { id, instanceId } = params;
    return this.businessService.returnWhatsappConnectionById(user, id, instanceId);
  }

  @UseGuards(AuthGuard)
  @Post('/:id/disconnect/whatsapp-connection/:instanceId')
  public async disconnectWhatsappConnectionById(
    @User() user,
    @Param() params: any
  ): Promise<Business> {
    const { id, instanceId } = params;
    return this.businessService.disconnectedWhatsappConnectionById(user, id, instanceId);
  }

  @UseGuards(AuthGuard)
  @Get('/:id/whatsapp-connection/status')
  public async statusWhatsappConnectionById(
    @User() user,
    @Param() params: any
  ): Promise<WhatsappConnection> {
    const { id } = params;
    return this.businessService.statusWhatsappConnectionById(user, id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/user/permissions')
  @ApiOperation({
    summary: 'Get user permissions',
    description: 'Retrieves permissions for the authenticated user'
  })
  @ApiResponse({ status: 200, description: 'Permissions retrieved successfully' })
  public async getUserPermissions(@User() user: any): Promise<Record<string, boolean | number>> {
    console.log('🔐 [CONTROLLER] getUserPermissions - Usuario completo:', JSON.stringify(user, null, 2));

    const userId = typeof user === 'string' ? user : (user.id || user.userId || user.uid);
    const userType = user.userType || user.type;

    console.log('🔐 [CONTROLLER] Detected userType:', userType);
    console.log('🔐 [CONTROLLER] UserId:', userId);
    console.log('🔐 [CONTROLLER] User.businessId:', user.businessId);
    console.log('🔐 [CONTROLLER] User.commerceId:', user.commerceId);
    console.log('🔐 [CONTROLLER] User.permissions:', JSON.stringify(user.permissions || {}, null, 2));

    let result;

    // Obtener permisos según el tipo de usuario
    if (userType === 'master') {
      console.log('🔐 [CONTROLLER] Processing as MASTER user');
      result = await this.permissionService.getPermissionsForMaster();
    } else if (userType === 'administrator' || userType === 'business') {
      console.log('🔐 [CONTROLLER] Processing as BUSINESS/ADMINISTRATOR user');
      // Para administrators, necesitamos el businessId
      const businessId = user.businessId;
      console.log('🔐 [CONTROLLER] BusinessId para administrator:', businessId);
      if (businessId) {
        const userPermissions = user.permissions || {};
        result = await this.permissionService.getPermissionsForBusiness(businessId, userPermissions);
      }
    } else if (userType === 'collaborator') {
      console.log('🔐 [CONTROLLER] Processing as COLLABORATOR user');
      // Para collaborators, necesitamos el commerceId y usamos getPermissionsForCollaborator
      const commerceId = user.commerceId;
      console.log('🔐 [CONTROLLER] CommerceId para collaborator:', commerceId);
      if (commerceId) {
        const userPermissions = user.permissions || {};
        result = await this.permissionService.getPermissionsForCollaborator(commerceId, userPermissions);
      }
    } else if (userType === 'client') {
      console.log('🔐 [CONTROLLER] Processing as CLIENT user');
      // Para clients, necesitamos el commerceId
      const commerceId = user.commerceId;
      console.log('🔐 [CONTROLLER] CommerceId para client:', commerceId);
      if (commerceId) {
        const userPermissions = user.permissions || {};
        result = await this.permissionService.getPermissionsForClient(commerceId, userPermissions);
      }
    }

    // Fallback - retornar permisos básicos
    if (!result) {
      console.log('🔐 [CONTROLLER] No se pudieron obtener permisos, usando fallback');
      result = {
        'messages.admin.send': false,
        'messages.admin.view': false,
        'chats.admin.start': false,
        'chats.admin.view': false
      };
    }

    console.log('🔐 [CONTROLLER] RESULTADO FINAL enviado al frontend:', JSON.stringify(result, null, 2));
    console.log('🔐 [CONTROLLER] Total de permisos en resultado:', Object.keys(result).length);

    return result;
  }
}
