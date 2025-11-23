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

import { BusinessService } from './business.service';
import { BusinessKeyNameDetailsDto } from './dto/business-keyname-details.dto';
import { Business, WhatsappConnection } from './model/business.entity';

@ApiTags('business')
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

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
}
