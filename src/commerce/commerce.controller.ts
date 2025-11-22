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

import { SimpleGuard } from '../auth/simple.guard';

import { CommerceService } from './commerce.service';
import { CommerceKeyNameDetailsDto } from './dto/commerce-keyname-details.dto';
import { Commerce } from './model/commerce.entity';

@ApiTags('commerce')
@Controller('commerce')
export class CommerceController {
  constructor(private readonly commerceService: CommerceService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get commerce by ID',
    description: 'Retrieves a commerce by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'Commerce found', type: Commerce })
  @ApiResponse({ status: 404, description: 'Commerce not found' })
  public async getCommerceById(@Param() params: any): Promise<Commerce> {
    const { id } = params;
    return this.commerceService.getCommerceById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('details/:id')
  @ApiOperation({
    summary: 'Get commerce details',
    description: 'Retrieves detailed commerce information',
  })
  @ApiParam({ name: 'id', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'Commerce details', type: CommerceKeyNameDetailsDto })
  public async getCommerceDetails(@Param() params: any): Promise<CommerceKeyNameDetailsDto> {
    const { id } = params;
    return this.commerceService.getCommerceDetails(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/keyName/:keyName')
  @ApiOperation({
    summary: 'Get commerce by key name',
    description: 'Retrieves a commerce by its unique key name',
  })
  @ApiParam({ name: 'keyName', description: 'Commerce key name', example: 'my-commerce' })
  @ApiResponse({ status: 200, description: 'Commerce found', type: CommerceKeyNameDetailsDto })
  public async getCommerceByKeyName(@Param() params: any): Promise<CommerceKeyNameDetailsDto> {
    const { keyName } = params;
    return this.commerceService.getCommerceByKeyName(keyName);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({ summary: 'Get all commerces', description: 'Retrieves a list of all commerces' })
  @ApiResponse({ status: 200, description: 'List of commerces', type: [Commerce] })
  public async getCommerces(): Promise<Commerce[]> {
    return this.commerceService.getCommerces();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/businessId/:businessId')
  @ApiOperation({
    summary: 'Get commerces by business ID',
    description: 'Retrieves all commerces for a specific business',
  })
  @ApiParam({ name: 'businessId', description: 'Business ID', example: 'business-123' })
  @ApiResponse({ status: 200, description: 'List of commerces', type: [Commerce] })
  public async getCommercesByBusinessId(@Param() params: any): Promise<Commerce[]> {
    const { businessId } = params;
    return this.commerceService.getCommercesByBusinessId(businessId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/businessId/:businessId/active')
  @ApiOperation({
    summary: 'Get active commerces by business ID',
    description: 'Retrieves all active commerces for a specific business',
  })
  @ApiParam({ name: 'businessId', description: 'Business ID', example: 'business-123' })
  @ApiResponse({
    status: 200,
    description: 'List of active commerces',
    type: [CommerceKeyNameDetailsDto],
  })
  public async getActiveCommercesByBusinessId(
    @Param() params: any
  ): Promise<CommerceKeyNameDetailsDto[]> {
    const { businessId } = params;
    return this.commerceService.getActiveCommercesByBusinessId(businessId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new commerce',
    description: 'Creates a new commerce/location',
  })
  @ApiBody({ type: Commerce })
  @ApiResponse({ status: 201, description: 'Commerce created successfully', type: Commerce })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createCommerce(@User() user, @Body() body: Commerce): Promise<Commerce> {
    const {
      name,
      keyName,
      tag,
      businessId,
      country,
      email,
      logo,
      phone,
      url,
      localeInfo,
      contactInfo,
      serviceInfo,
      category,
    } = body;
    return this.commerceService.createCommerce(
      user,
      name,
      keyName,
      tag,
      businessId,
      country,
      email,
      logo,
      phone,
      url,
      localeInfo,
      contactInfo,
      serviceInfo,
      category
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({ summary: 'Update commerce', description: 'Updates an existing commerce' })
  @ApiParam({ name: 'id', description: 'Commerce ID', example: 'commerce-123' })
  @ApiBody({ type: Commerce })
  @ApiResponse({ status: 200, description: 'Commerce updated successfully', type: Commerce })
  @ApiResponse({ status: 404, description: 'Commerce not found' })
  public async updateCommerce(
    @User() user,
    @Param() params: any,
    @Body() body: Commerce
  ): Promise<Commerce> {
    const { id } = params;
    const {
      tag,
      logo,
      phone,
      url,
      active,
      available,
      localeInfo,
      contactInfo,
      serviceInfo,
      category,
    } = body;
    return this.commerceService.updateCommerce(
      user,
      id,
      tag,
      logo,
      phone,
      url,
      active,
      available,
      localeInfo,
      contactInfo,
      serviceInfo,
      category
    );
  }

  @UseGuards(SimpleGuard)
  @Post('/notify/monthly-statistics')
  public async notifyCommerceStatistics(): Promise<any> {
    return await this.commerceService.notifyCommerceStatistics();
  }
}
