import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PartnerService } from './partner.service';
import { Partner } from './partner.entity';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('partner')
export class PartnerController {
    constructor(private readonly partnerService: PartnerService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getPartnerById(@Param() params: any): Promise<Partner> {
        const { id } = params;
        return this.partnerService.getPartnerById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getPartners(): Promise<Partner[]> {
        return this.partnerService.getPartners();
    }

    @Get('/email/:email')
    public async getPartnerByEmail(@Param() params: any): Promise<Partner> {
        const { email } = params;
        return this.partnerService.getPartnerByEmail(email);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updatePartner(@Param() params: any, @Body() body: any): Promise<Partner> {
        const { id } = params;
        const { alias, phone, moduleId, active, businessIds } = body;
        return this.partnerService.updatePartner(id, phone, active, alias, businessIds);
    }

    @UseGuards(AuthGuard)
    @Patch('/desactivate/:id')
    public async desactivate(@Param() params: any): Promise<Partner> {
        const { id } = params;
        return this.partnerService.changeStatus(id, false);
    }

    @UseGuards(AuthGuard)
    @Patch('/activate/:id')
    public async activate(@Param() params: any): Promise<Partner> {
        const { id } = params;
        return this.partnerService.changeStatus(id, true);
    }

    @UseGuards(AuthGuard)
    @Post()
    public async createPartner(@Body() body: Partner): Promise<Partner> {
        const { name, businessIds, email, phone, alias } = body;
        return this.partnerService.createPartner(name, email, phone, businessIds, alias);
    }

    @Patch('/register-token/:id')
    public async registerToken(@Param() params: any, @Body() body: any): Promise<Partner> {
        const { id } = params;
        const { token } = body;
        return this.partnerService.updateToken(id, token);
    }

    @Patch('/change-password/:id')
    public async changePassword(@Param() params: any): Promise<Partner> {
        const { id } = params;
        return this.partnerService.changePassword(id);
    }
}