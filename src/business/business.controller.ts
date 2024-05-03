import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BusinessService } from './business.service';
import { Business, WhatsappConnection } from './model/business.entity';
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

    @UseGuards(AuthGuard)
    @Get('/:id/whatsapp-connection')
    public async getWhatsappConnectionById(@Param() params: any): Promise<WhatsappConnection> {
        const { id } = params;
        return this.businessService.getWhatsappConnectionById(id);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id/whatsapp-connection')
    public async updateWhatsappConnection(@User() user, @Param() params: any, @Body() body: WhatsappConnection): Promise<Business> {
        const { id } = params;
        const { idConnection, whatsapp } = body;
        return this.businessService.updateWhatsappConnection(user, id, idConnection, whatsapp);
    }

    @UseGuards(AuthGuard)
    @Post('/:id/resquest/whatsapp-connection/:whatsapp')
    public async requestWhatsappConnectionById(@User() user, @Param() params: any): Promise<Business> {
        const { id, whatsapp } = params;
        return this.businessService.requestWhatsappConnectionById(user, id, whatsapp);
    }

    @UseGuards(AuthGuard)
    @Post('/:id/return/whatsapp-connection/:instanceId')
    public async returnWhatsappConnectionById(@User() user,  @Param() params: any): Promise<Business> {
        const { id, instanceId } = params;
        return this.businessService.returnWhatsappConnectionById(user, id, instanceId);
    }

    @UseGuards(AuthGuard)
    @Post('/:id/disconnect/whatsapp-connection/:instanceId')
    public async disconnectWhatsappConnectionById(@User() user,  @Param() params: any): Promise<Business> {
        const { id, instanceId } = params;
        return this.businessService.disconnectedWhatsappConnectionById(user, id, instanceId);
    }

    @UseGuards(AuthGuard)
    @Get('/:id/whatsapp-connection/status')
    public async statusWhatsappConnectionById(@User() user, @Param() params: any): Promise<WhatsappConnection> {
        const { id } = params;
        return this.businessService.statusWhatsappConnectionById(user, id);
    }
}