import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ServiceService } from './service.service';
import { Service } from './model/service.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { SimpleGuard } from '../auth/simple.guard';
import { User } from 'src/auth/user.decorator';

@Controller('service')
export class ServiceController {
    constructor(private readonly serviceService: ServiceService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getServiceById(@Param() params: any): Promise<Service> {
        const { id } = params;
        return this.serviceService.getServiceById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getServices(): Promise<Service[]> {
        return this.serviceService.getServices();
    }

    @UseGuards(AuthGuard)
    @Get('/commerce/:commerceId')
    public async getServiceByCommerce(@Param() params: any): Promise<Service[]> {
        const { commerceId } = params;
        return this.serviceService.getServiceByCommerce(commerceId);
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createService(@User() user, @Body() body: Service): Promise<Service> {
        const { commerceId, name, type, tag, online, order, serviceInfo } = body;
        return this.serviceService.createService(user, commerceId, name, type, tag, online, order, serviceInfo);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateService(@User() user, @Param() params: any, @Body() body: Service): Promise<Service> {
        const { id } = params;
        const { name, tag, order, active, online, serviceInfo } = body;
        return this.serviceService.updateServiceConfigurations(user, id, name, tag, order, active, online, serviceInfo);
    }
}