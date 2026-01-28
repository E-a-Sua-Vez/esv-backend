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

import { Service } from './model/service.entity';
import { ServiceService } from './service.service';

@ApiTags('service')
@Controller('service')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get service by ID',
    description: 'Retrieves a service by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Service ID', example: 'service-123' })
  @ApiResponse({ status: 200, description: 'Service found', type: Service })
  @ApiResponse({ status: 404, description: 'Service not found' })
  public async getServiceById(@Param() params: any): Promise<Service> {
    const { id } = params;
    return this.serviceService.getServiceById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({ summary: 'Get all services', description: 'Retrieves a list of all services' })
  @ApiResponse({ status: 200, description: 'List of services', type: [Service] })
  public async getServices(): Promise<Service[]> {
    return this.serviceService.getServices();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId')
  @ApiOperation({
    summary: 'Get services by commerce',
    description: 'Retrieves all services for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of services', type: [Service] })
  public async getServiceByCommerce(@Param() params: any): Promise<Service[]> {
    const { commerceId } = params;
    return this.serviceService.getServiceByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/active')
  @ApiOperation({
    summary: 'Get active services by commerce',
    description: 'Retrieves all active services for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of active services', type: [Service] })
  public async getActiveServicesByCommerceId(@Param() params: any): Promise<Service[]> {
    const { commerceId } = params;
    return this.serviceService.getActiveServicesByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/list/:ids')
  @ApiOperation({
    summary: 'Get services by IDs',
    description: 'Retrieves multiple services by their IDs (comma-separated)',
  })
  @ApiParam({
    name: 'ids',
    description: 'Comma-separated service IDs',
    example: 'service-1,service-2,service-3',
  })
  @ApiResponse({ status: 200, description: 'List of services', type: [Service] })
  public async getServicesById(@Param() params: any): Promise<Service[]> {
    const { ids } = params;
    return this.serviceService.getServicesById(ids.split(','));
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new service',
    description: 'Creates a new service for a commerce',
  })
  @ApiBody({ type: Service })
  @ApiResponse({ status: 201, description: 'Service created successfully', type: Service })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createService(@User() user, @Body() body: Service): Promise<Service> {
    const { commerceId, name, type, tag, online, order, serviceInfo } = body;
    return this.serviceService.createService(
      user,
      commerceId,
      name,
      type,
      tag,
      online,
      order,
      serviceInfo
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update service',
    description: 'Updates the configuration of an existing service',
  })
  @ApiParam({ name: 'id', description: 'Service ID', example: 'service-123' })
  @ApiBody({ type: Service })
  @ApiResponse({ status: 200, description: 'Service updated successfully', type: Service })
  @ApiResponse({ status: 404, description: 'Service not found' })
  public async updateService(
    @User() user,
    @Param() params: any,
    @Body() body: Service
  ): Promise<Service> {
    const { id } = params;
    const { name, type, tag, order, active, available, online, serviceInfo } = body;
    return this.serviceService.updateServiceConfigurations(
      user,
      id,
      name,
      type,
      tag,
      order,
      active,
      available,
      online,
      serviceInfo
    );
  }
}
