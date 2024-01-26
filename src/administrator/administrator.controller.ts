import { Controller, Get, Param, Body, Patch, UseGuards, Post } from '@nestjs/common';
import { AdministratorService } from './administrator.service';
import { Administrator } from './model/administrator.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('administrator')
export class AdministratorController {
    constructor(private readonly administratorService: AdministratorService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getAdministratorById(@Param() params: any): Promise<Administrator> {
        const { id } = params;
        return this.administratorService.getAdministratorById(id);
    }

    @UseGuards(AuthGuard)
    @Post()
    public async createAdministrator(@User() user, @Body() body: any): Promise<Administrator> {
        console.log("🚀 ~ AdministratorController ~ createAdministrator ~ body:", body);
        const { name, businessId, commercesId, email } = body;
        return this.administratorService.createAdministrator(user, name, businessId, commercesId, email);
    }

    @Get('/email/:email')
    public async getAdministratorByEmail(@Param() params: any): Promise<Administrator> {
        const { email } = params;
        return this.administratorService.getAdministratorByEmail(email);
    }

    @Get('/email/:email/master')
    public async getMasterAdministratorByEmail(@Param() params: any): Promise<Administrator> {
        const { email } = params;
        return this.administratorService.getMasterAdministratorByEmail(email);
    }

    @Patch('/register-token/:id')
    public async registerToken(@Param() params: any, @Body() body: any): Promise<Administrator> {
        const { id } = params;
        const { token } = body;
        return this.administratorService.updateToken(id, token);
    }

    @Patch('/change-password/:id')
    public async changePassword(@Param() params: any): Promise<Administrator> {
        const { id } = params;
        return this.administratorService.changePassword(id);
    }

    @UseGuards(AuthGuard)
    @Get('/businessId/:businessId')
    public async getAdministratorsByBusinessId(@Param() params: any): Promise<Administrator[]> {
        const { businessId } = params;
        return this.administratorService.getAdministratorsByBusinessId(businessId);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateAdministrator(@User() user, @Param() params: any, @Body() body: any): Promise<Administrator> {
        const { id } = params;
        const { active, commercesId } = body;
        return this.administratorService.updateAdministrator(user, id, commercesId, active);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id/permission')
    public async updateAdministratorPermission(@User() user, @Param() params: any, @Body() body: any): Promise<Administrator> {
        const { id } = params;
        const { name, value } = body;
        return this.administratorService.updateAdministratorPermission(user, id, name, value);
    }
}