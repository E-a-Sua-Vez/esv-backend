import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PackageService } from './package.service';
import { Package } from './model/package.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('package')
export class PackageController {
  constructor(private readonly incomeTypeService: PackageService) {}

  @UseGuards(AuthGuard)
  @Get('/:id')
  public async getPackageById(@Param() params: any): Promise<Package> {
    const { id } = params;
    return this.incomeTypeService.getPackageById(id);
  }

  @UseGuards(AuthGuard)
  @Get('/')
  public async getPackages(): Promise<Package[]> {
    return this.incomeTypeService.getPackages();
  }

  @UseGuards(AuthGuard)
  @Get('/commerce/:commerceId')
  public async getPackageByCommerce(@Param() params: any): Promise<Package[]> {
    const { commerceId } = params;
    return this.incomeTypeService.getPackageByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @Get('/commerceId/:commerceId/clientId/:clientId')
  public async getPackageByCommerceIdAndClientId(@Param() params: any): Promise<Package[]> {
    const { commerceId, clientId } = params;
    return this.incomeTypeService.getPackageByCommerceIdAndClientId(commerceId, clientId);
  }

  @UseGuards(AuthGuard)
  @Get('/commerceId/:commerceId/serviceId/:serviceId/clientId/:clientId')
  public async getPackageByCommerceIdAndClientServices(@Param() params: any): Promise<Package[]> {
    const { commerceId, clientId, serviceId } = params;
    return this.incomeTypeService.getPackageByCommerceIdAndClientServices(commerceId, clientId, serviceId);
  }

  @UseGuards(AuthGuard)
  @Get('/list/:ids')
  public async getPackagesById(@Param() params: any): Promise<Package[]> {
    const { ids } = params;
    return this.incomeTypeService.getPackagesById(ids.split(','));
  }

  @UseGuards(AuthGuard)
  @Post('/')
  public async createPackage(@User() user, @Body() body: Package): Promise<Package> {
    const {
      commerceId, clientId, firstBookingId, firstAttentionId, proceduresAmount,
      name, servicesId, bookingsId, attentionsId, type, status
    } = body;
    return this.incomeTypeService.createPackage(
      user, commerceId, clientId, firstBookingId, firstAttentionId, proceduresAmount, name,
      servicesId,  bookingsId, attentionsId, type, status
    );
  }

  @UseGuards(AuthGuard)
  @Patch('/:id')
  public async updatePackage(@User() user, @Param() params: any, @Body() body: Package): Promise<Package> {
    const { id } = params;
    const { firstBookingId, firstAttentionId, proceduresAmount, proceduresLeft,
        name, servicesId, bookingsId, attentionsId, active, available,
        type, status, cancelledAt, cancelledBy, completedAt, completedBy, expireAt } = body;
    return this.incomeTypeService.updatePackageConfigurations(
        user, id, firstBookingId, firstAttentionId, proceduresAmount, proceduresLeft,
        name, servicesId, bookingsId, attentionsId, active, available,
        type, status, cancelledAt, cancelledBy, completedAt, completedBy, expireAt
    );
  }

  @UseGuards(AuthGuard)
  @Patch('/cancel/:id')
  public async cancelPackage(@User() user, @Param() params: any): Promise<Package> {
    const { id } = params;
    return this.incomeTypeService.cancelPackage(user, id);
  }

  @UseGuards(AuthGuard)
  @Patch('/pay/:id')
  public async payPackage(@User() user, @Param() params: any, @Body() body: Package): Promise<Package> {
    const { id } = params;
    const { incomesId } = body;
    return this.incomeTypeService.payPackage(user, id, incomesId);
  }
}
