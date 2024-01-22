import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CommerceService } from './commerce.service';
import { Commerce } from './model/commerce.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';
import { SimpleGuard } from '../auth/simple.guard';

@Controller('commerce')
export class CommerceController {
    constructor(private readonly commerceService: CommerceService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getCommerceById(@Param() params: any): Promise<Commerce> {
        const { id } = params;
        return this.commerceService.getCommerceById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/keyName/:keyName')
    public async getCommerceByKeyName(@Param() params: any): Promise<Commerce> {
        const { keyName } = params;
        return this.commerceService.getCommerceByKeyName(keyName);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getCommerces(): Promise<Commerce[]> {
        return this.commerceService.getCommerces();
    }

    @UseGuards(AuthGuard)
    @Get('/businessId/:businessId')
    public async getCommercesByBusinessId(@Param() params: any): Promise<Commerce[]> {
        const { businessId } = params;
        return this.commerceService.getCommercesByBusinessId(businessId);
    }

    @UseGuards(AuthGuard)
    @Get('/businessId/:businessId/active')
    public async getActiveCommercesByBusinessId(@Param() params: any): Promise<Commerce[]> {
        const { businessId } = params;
        return this.commerceService.getActiveCommercesByBusinessId(businessId);
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createCommerce(@User() user, @Body() body: Commerce): Promise<Commerce> {
        const { name, keyName, tag, businessId, country, email, logo, phone, url, localeInfo, contactInfo, serviceInfo, category } = body;
        return this.commerceService.createCommerce(user, name, keyName, tag, businessId, country, email, logo, phone, url, localeInfo, contactInfo, serviceInfo, category);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateCommerce(@User() user, @Param() params: any, @Body() body: Commerce): Promise<Commerce> {
        const { id } = params;
        const { tag, logo, phone, url, active, localeInfo, contactInfo, serviceInfo, category } = body;
        return this.commerceService.updateCommerce(user, id, tag, logo, phone, url, active, localeInfo, contactInfo, serviceInfo, category);
    }

    @UseGuards(SimpleGuard)
    @Post('/notify/monthly-statistics')
    public async notifyCommerceStatistics(): Promise<any> {
        return await this.commerceService.notifyCommerceStatistics();
    }
}