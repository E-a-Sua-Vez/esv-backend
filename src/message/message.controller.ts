import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { MessageService } from './message.service';
import { Message } from './model/message.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('message')
export class MessageController {
    constructor(private readonly messageService: MessageService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getMessageById(@Param() params: any): Promise<Message> {
        const { id } = params;
        return this.messageService.getMessageById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getMessages(): Promise<Message[]> {
        return this.messageService.getMessages();
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/clientId/:clientId')
    public async getMessagesByClient(@Param() params: any): Promise<Message[]> {
        const { clientId } = params;
        return this.messageService.getMessagesByClient(clientId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/administratorId/:clientId')
    public async getMessagesByAdministrator(@Param() params: any): Promise<Message[]> {
        const { administratorId } = params;
        return this.messageService.getMessagesByAdministrator(administratorId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/collaboratorId/:collaboratorId')
    public async getMessagesByCollaborator(@Param() params: any): Promise<Message[]> {
        const { collaboratorId } = params;
        return this.messageService.getMessagesByCollaborator(collaboratorId);
    }

    @UseGuards(AuthGuard)
    @Post()
    public async createMessage(@User() user, @Body() body: any): Promise<Message> {
        const { type, commerceId, administratorId, collaboratorId, clientId, title, content, link, icon } = body;
        return this.messageService.createMessage(user, type, commerceId, administratorId, collaboratorId, clientId, title, content, link, icon);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateMessageConfigurations(@User() user, @Param() params: any, @Body() body: Message): Promise<Message> {
        const { id } = params;
        const { active, available, read } = body;
        return this.messageService.updateMessageConfigurations(user, id, active, available, read);
    }

    @UseGuards(AuthGuard)
    @Patch('/all/read')
    public async markAllAsRead(@User() user, @Body() body: Message): Promise<Message[]> {
        const { administratorId, collaboratorId, clientId } = body;
        return this.messageService.markAllAsRead(user, administratorId, collaboratorId, clientId);
    }
}