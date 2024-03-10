import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CollaboratorService } from './collaborator.service';
import { Collaborator } from './model/collaborator.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('collaborator')
export class CollaboratorController {
    constructor(private readonly collaboratorService: CollaboratorService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getCollaboratorById(@Param() params: any): Promise<Collaborator> {
        const { id } = params;
        return this.collaboratorService.getCollaboratorById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getCollaborators(): Promise<Collaborator[]> {
        return this.collaboratorService.getCollaborators();
    }

    @Get('/email/:email')
    public async getCollaboratorByEmail(@Param() params: any): Promise<Collaborator> {
        const { email } = params;
        return this.collaboratorService.getCollaboratorByEmail(email);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId')
    public async getCollaboratorsByCommerceId(@Param() params: any): Promise<Collaborator[]> {
        const { commerceId } = params;
        return this.collaboratorService.getCollaboratorsByCommerceId(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/email/:email')
    public async getCollaboratorsByCommerceIdAndEmail(@Param() params: any): Promise<Collaborator> {
        const { commerceId, email } = params;
        return this.collaboratorService.getCollaboratorsByCommerceIdAndEmail(commerceId, email);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateCollaborator(@User() user, @Param() params: any, @Body() body: any): Promise<Collaborator> {
        const { id } = params;
        const { name, type, alias, phone, moduleId, active, available, servicesId, commercesId } = body;
        return this.collaboratorService.updateCollaborator(user, id, name, moduleId, phone, active, available, alias, servicesId, type, commercesId);
    }

    @UseGuards(AuthGuard)
    @Patch('/desactivate/:id')
    public async desactivate(@User() user, @Param() params: any): Promise<Collaborator> {
        const { id } = params;
        return this.collaboratorService.changeStatus(user, id, false);
    }

    @UseGuards(AuthGuard)
    @Patch('/activate/:id')
    public async activate(@User() user, @Param() params: any): Promise<Collaborator> {
        const { id } = params;
        return this.collaboratorService.changeStatus(user, id, true);
    }

    @UseGuards(AuthGuard)
    @Post()
    public async createCollaborator(@User() user, @Body() body: Collaborator): Promise<Collaborator> {
        const { name, commerceId, commercesId, email, type, phone, moduleId, bot, alias, servicesId } = body;
        return this.collaboratorService.createCollaborator(user, name, commerceId, commercesId, email, type, phone, moduleId, bot, alias, servicesId);
    }

    @Patch('/register-token/:id')
    public async registerToken(@User() user, @Param() params: any, @Body() body: any): Promise<Collaborator> {
        const { id } = params;
        const { token } = body;
        return this.collaboratorService.updateToken(user, id, token);
    }

    @Patch('/change-password/:id')
    public async changePassword(@User() user, @Param() params: any): Promise<Collaborator> {
        const { id } = params;
        return this.collaboratorService.changePassword(user, id);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id/permission')
    public async updateCollaboratorPermission(@User() user, @Param() params: any, @Body() body: any): Promise<Collaborator> {
        const { id } = params;
        const { name, value } = body;
        return this.collaboratorService.updateCollaboratorPermission(user, id, name, value);
    }
}