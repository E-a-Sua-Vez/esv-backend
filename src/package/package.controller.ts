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

import { Package } from './model/package.entity';
import { PackageService } from './package.service';

@ApiTags('package')
@Controller('package')
export class PackageController {
  constructor(private readonly incomeTypeService: PackageService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get package by ID',
    description: 'Retrieves a package by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Package ID', example: 'package-123' })
  @ApiResponse({ status: 200, description: 'Package found', type: Package })
  @ApiResponse({ status: 404, description: 'Package not found' })
  public async getPackageById(@Param() params: any): Promise<Package> {
    const { id } = params;
    return this.incomeTypeService.getPackageById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({ summary: 'Get all packages', description: 'Retrieves a list of all packages' })
  @ApiResponse({ status: 200, description: 'List of packages', type: [Package] })
  public async getPackages(): Promise<Package[]> {
    return this.incomeTypeService.getPackages();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId')
  @ApiOperation({
    summary: 'Get packages by commerce',
    description: 'Retrieves all packages for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of packages', type: [Package] })
  public async getPackageByCommerce(@Param() params: any): Promise<Package[]> {
    const { commerceId } = params;
    return this.incomeTypeService.getPackageByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/clientId/:clientId')
  @ApiOperation({
    summary: 'Get packages by commerce and client',
    description: 'Retrieves all packages for a specific commerce and client',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'clientId', description: 'Client ID', example: 'client-123' })
  @ApiResponse({ status: 200, description: 'List of packages', type: [Package] })
  public async getPackageByCommerceIdAndClientId(@Param() params: any): Promise<Package[]> {
    const { commerceId, clientId } = params;
    return this.incomeTypeService.getPackageByCommerceIdAndClientId(commerceId, clientId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/serviceId/:serviceId/clientId/:clientId')
  @ApiOperation({
    summary: 'Get packages by commerce, service, and client',
    description: 'Retrieves packages filtered by commerce, service, and client',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'serviceId', description: 'Service ID', example: 'service-123' })
  @ApiParam({ name: 'clientId', description: 'Client ID', example: 'client-123' })
  @ApiResponse({ status: 200, description: 'List of packages', type: [Package] })
  public async getPackageByCommerceIdAndClientServices(@Param() params: any): Promise<Package[]> {
    const { commerceId, clientId, serviceId } = params;
    return this.incomeTypeService.getPackageByCommerceIdAndClientServices(
      commerceId,
      clientId,
      serviceId
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/list/:ids')
  @ApiOperation({
    summary: 'Get packages by IDs',
    description: 'Retrieves multiple packages by their IDs (comma-separated)',
  })
  @ApiParam({
    name: 'ids',
    description: 'Comma-separated package IDs',
    example: 'package-1,package-2,package-3',
  })
  @ApiResponse({ status: 200, description: 'List of packages', type: [Package] })
  public async getPackagesById(@Param() params: any): Promise<Package[]> {
    const { ids } = params;
    return this.incomeTypeService.getPackagesById(ids.split(','));
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new package',
    description: 'Creates a new service package for a client',
  })
  @ApiBody({ type: Package })
  @ApiResponse({ status: 201, description: 'Package created successfully', type: Package })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createPackage(@User() user, @Body() body: Package): Promise<Package> {
    const {
      commerceId,
      clientId,
      firstBookingId,
      firstAttentionId,
      proceduresAmount,
      name,
      servicesId,
      bookingsId,
      attentionsId,
      type,
      status,
    } = body;
    return this.incomeTypeService.createPackage(
      user,
      commerceId,
      clientId,
      firstBookingId,
      firstAttentionId,
      proceduresAmount,
      name,
      servicesId,
      bookingsId,
      attentionsId,
      type,
      status
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update package',
    description: 'Updates package configuration and information',
  })
  @ApiParam({ name: 'id', description: 'Package ID', example: 'package-123' })
  @ApiBody({ type: Package })
  @ApiResponse({ status: 200, description: 'Package updated successfully', type: Package })
  @ApiResponse({ status: 404, description: 'Package not found' })
  public async updatePackage(
    @User() user,
    @Param() params: any,
    @Body() body: Package
  ): Promise<Package> {
    const { id } = params;
    const {
      firstBookingId,
      firstAttentionId,
      proceduresAmount,
      proceduresLeft,
      name,
      servicesId,
      bookingsId,
      attentionsId,
      active,
      available,
      type,
      status,
      cancelledAt,
      cancelledBy,
      completedAt,
      completedBy,
      expireAt,
    } = body;
    return this.incomeTypeService.updatePackageConfigurations(
      user,
      id,
      firstBookingId,
      firstAttentionId,
      proceduresAmount,
      proceduresLeft,
      name,
      servicesId,
      bookingsId,
      attentionsId,
      active,
      available,
      type,
      status,
      cancelledAt,
      cancelledBy,
      completedAt,
      completedBy,
      expireAt
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/cancel/:id')
  @ApiOperation({ summary: 'Cancel package', description: 'Cancels an active package' })
  @ApiParam({ name: 'id', description: 'Package ID', example: 'package-123' })
  @ApiResponse({ status: 200, description: 'Package cancelled successfully', type: Package })
  @ApiResponse({ status: 404, description: 'Package not found' })
  public async cancelPackage(@User() user, @Param() params: any): Promise<Package> {
    const { id } = params;
    return this.incomeTypeService.cancelPackage(user, id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/pay/:id')
  @ApiOperation({
    summary: 'Pay package',
    description: 'Marks a package as paid using income records',
  })
  @ApiParam({ name: 'id', description: 'Package ID', example: 'package-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        incomesId: { type: 'array', items: { type: 'string' }, example: ['income-1', 'income-2'] },
      },
      required: ['incomesId'],
    },
  })
  @ApiResponse({ status: 200, description: 'Package paid successfully', type: Package })
  @ApiResponse({ status: 404, description: 'Package not found' })
  public async payPackage(
    @User() user,
    @Param() params: any,
    @Body() body: Package
  ): Promise<Package> {
    const { id } = params;
    const { incomesId } = body;
    return this.incomeTypeService.payPackage(user, id, incomesId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId/active')
  @ApiOperation({
    summary: 'Get active packages by commerce',
    description: 'Retrieves all active packages for a specific commerce with sessions remaining',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of active packages', type: [Package] })
  public async getActivePackagesByCommerce(@Param() params: any): Promise<Package[]> {
    const { commerceId } = params;
    return this.incomeTypeService.getActivePackagesByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId/client/:clientId/all')
  @ApiOperation({
    summary: 'Get all packages by client',
    description: 'Retrieves all packages for a client grouped by status',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'clientId', description: 'Client ID', example: 'client-123' })
  @ApiResponse({
    status: 200,
    description: 'Packages grouped by status',
    schema: {
      type: 'object',
      properties: {
        active: { type: 'array', items: { $ref: '#/components/schemas/Package' } },
        completed: { type: 'array', items: { $ref: '#/components/schemas/Package' } },
        expired: { type: 'array', items: { $ref: '#/components/schemas/Package' } },
        cancelled: { type: 'array', items: { $ref: '#/components/schemas/Package' } },
      },
    },
  })
  public async getPackagesByClient(@Param() params: any): Promise<{
    active: Package[];
    completed: Package[];
    expired: Package[];
    cancelled: Package[];
  }> {
    const { commerceId, clientId } = params;
    return this.incomeTypeService.getPackagesByClient(commerceId, clientId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId/client/:clientId/active')
  @ApiOperation({
    summary: 'Get active packages by client',
    description: 'Retrieves active packages for a specific client',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'clientId', description: 'Client ID', example: 'client-123' })
  @ApiResponse({ status: 200, description: 'List of active packages', type: [Package] })
  public async getActivePackagesByClient(@Param() params: any): Promise<Package[]> {
    const { commerceId, clientId } = params;
    return this.incomeTypeService.getActivePackagesByClient(commerceId, clientId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId/service/:serviceId/client/:clientId/available')
  @ApiOperation({
    summary: 'Get available packages for service',
    description: 'Retrieves available packages for a specific service that can be used for booking',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'serviceId', description: 'Service ID', example: 'service-123' })
  @ApiParam({ name: 'clientId', description: 'Client ID', example: 'client-123' })
  @ApiResponse({ status: 200, description: 'List of available packages', type: [Package] })
  public async getAvailablePackagesForService(@Param() params: any): Promise<Package[]> {
    const { commerceId, serviceId, clientId } = params;
    return this.incomeTypeService.getAvailablePackagesForService(commerceId, clientId, serviceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/analytics/:commerceId')
  @ApiOperation({
    summary: 'Get package analytics',
    description: 'Retrieves comprehensive analytics for packages in a commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({
    status: 200,
    description: 'Package analytics',
    schema: {
      type: 'object',
      properties: {
        totalPackages: { type: 'number' },
        activePackages: { type: 'number' },
        completedPackages: { type: 'number' },
        expiredPackages: { type: 'number' },
        totalSessionsSold: { type: 'number' },
        totalSessionsUsed: { type: 'number' },
        totalSessionsRemaining: { type: 'number' },
        averageSessionsPerPackage: { type: 'number' },
        averageCompletionRate: { type: 'number' },
        packagesByType: { type: 'object' },
        packagesByStatus: { type: 'object' },
        expiringSoon: { type: 'array', items: { $ref: '#/components/schemas/Package' } },
        lowSessions: { type: 'array', items: { $ref: '#/components/schemas/Package' } },
      },
    },
  })
  public async getPackageAnalytics(@Param() params: any): Promise<any> {
    const { commerceId } = params;
    return this.incomeTypeService.getPackageAnalytics(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/metrics/:commerceId')
  @ApiOperation({
    summary: 'Get package metrics analytics',
    description:
      'Retrieves detailed metrics: most requested packages, no-show rate, completion rate, abandonment rate',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({
    status: 200,
    description: 'Package metrics analytics',
    schema: {
      type: 'object',
      properties: {
        mostRequestedPackages: {
          type: 'array',
          description: 'Top packages by creation count',
        },
        overallNoShowRate: { type: 'number', description: 'Overall no-show rate percentage' },
        overallCompletionRate: { type: 'number', description: 'Overall completion rate percentage' },
        overallAbandonmentRate: {
          type: 'number',
          description: 'Overall abandonment rate percentage',
        },
        packagesByCompletionRate: {
          type: 'array',
          description: 'Packages sorted by completion rate',
        },
        packagesByNoShowRate: {
          type: 'array',
          description: 'Packages sorted by no-show rate',
        },
        abandonedPackages: {
          type: 'array',
          description: 'List of abandoned packages',
        },
      },
    },
  })
  public async getPackageMetricsAnalytics(@Param() params: any): Promise<any> {
    const { commerceId } = params;
    return this.incomeTypeService.getPackageMetricsAnalytics(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id/recommended-dates')
  @ApiOperation({
    summary: 'Get recommended session dates',
    description: 'Retrieves recommended dates for next sessions based on periodicity',
  })
  @ApiParam({ name: 'id', description: 'Package ID', example: 'package-123' })
  @ApiResponse({
    status: 200,
    description: 'List of recommended dates',
    schema: {
      type: 'array',
      items: { type: 'string', format: 'date-time' },
    },
  })
  public async getRecommendedSessionDates(@Param() params: any): Promise<Date[]> {
    const { id } = params;
    return this.incomeTypeService.getRecommendedSessionDates(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/pause/:id')
  @ApiOperation({
    summary: 'Pause package',
    description: 'Pauses an active package temporarily',
  })
  @ApiParam({ name: 'id', description: 'Package ID', example: 'package-123' })
  @ApiResponse({ status: 200, description: 'Package paused successfully', type: Package })
  @ApiResponse({ status: 404, description: 'Package not found' })
  public async pausePackage(@User() user, @Param() params: any): Promise<Package> {
    const { id } = params;
    return this.incomeTypeService.pausePackage(user, id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/resume/:id')
  @ApiOperation({
    summary: 'Resume package',
    description: 'Resumes a paused package',
  })
  @ApiParam({ name: 'id', description: 'Package ID', example: 'package-123' })
  @ApiResponse({ status: 200, description: 'Package resumed successfully', type: Package })
  @ApiResponse({ status: 404, description: 'Package not found' })
  public async resumePackage(@User() user, @Param() params: any): Promise<Package> {
    const { id } = params;
    return this.incomeTypeService.resumePackage(user, id);
  }
}
