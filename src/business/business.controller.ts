import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BusinessService } from './business.service';
import { Business } from './model/business.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('business')
export class BusinessController {
    constructor(private readonly businessService: BusinessService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getBusinessById(@Param() params: any): Promise<Business> {
        const { id } = params;
        return this.businessService.getBusinessById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/keyName/:keyName')
    public async getBusinessByKeyName(@Param() params: any): Promise<Business> {
        const { keyName } = params;
        return this.businessService.getBusinessByKeyName(keyName);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getBusiness(): Promise<Business[]> {
        return this.businessService.getBusinesses();
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createBusiness(@User() user, @Body() body: Business): Promise<Business> {
        const { name, keyName, country, email, logo, phone, url, category, localeInfo, contactInfo, serviceInfo, partnerId } = body;
        return this.businessService.createBusiness(user, name, keyName, country, email, logo, phone, url, category, localeInfo, contactInfo, serviceInfo, partnerId);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateBusiness(@User() user, @Param() params: any, @Body() body: Business): Promise<Business> {
        const { id } = params;
        const { logo, phone, url, active, category, localeInfo, contactInfo, serviceInfo, partnerId } = body;
        return this.businessService.updateBusiness(user, id, logo, phone, url, active, category, localeInfo, contactInfo, serviceInfo, partnerId);
    }
}