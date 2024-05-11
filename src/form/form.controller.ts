import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { FormService } from './form.service';
import { Form } from './model/form.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('form')
export class FormController {
    constructor(private readonly formService: FormService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getFormById(@Param() params: any): Promise<Form> {
        const { id } = params;
        return this.formService.getFormById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getForms(): Promise<Form[]> {
        return this.formService.getForms();
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/clientId/:clientId')
    public async getFormsByClient(@Param() params: any): Promise<Form[]> {
        const { commerceId, clientId } = params;
        return this.formService.getFormsByClient(commerceId, clientId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/clientId/:clientId/type/:type')
    public async getFormsByClientAndType(@Param() params: any): Promise<Form[]> {
        const { commerceId, clientId, type } = params;
        return this.formService.getFormsByClientAndType(commerceId, clientId, type);
    }

    @UseGuards(AuthGuard)
    @Post()
    public async createForm(@User() user, @Body() body: any): Promise<Form> {
        const { attentionId, personalizedId, type, bookingId, commerceId, queueId, clientId, questions, answers } = body;
        return this.formService.createForm(user, personalizedId, type, bookingId, attentionId, commerceId, queueId, clientId, questions, answers);
    }
}