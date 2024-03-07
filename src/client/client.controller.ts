import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ClientService } from './client.service';
import { Client } from './model/client.entity';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/user.decorator';
import { ClientContact } from 'src/client-contact/model/client-contact.entity';

@Controller('client')
export class ClientController {
    constructor(private readonly clientService: ClientService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getClientById(@Param() params: any): Promise<Client> {
        const { id } = params;
        return this.clientService.getClientById(id);
    }

    @UseGuards(AuthGuard)
    @Post('/contact/:id')
    public async contactClient(@User() user, @Param() params: any, @Body() body: any): Promise<ClientContact> {
        const { id } = params;
        const { result, type, comment, commerceId, collaboratorId } = body;
        return this.clientService.contactClient(user, id, type, result, comment, commerceId, collaboratorId);
    }
}