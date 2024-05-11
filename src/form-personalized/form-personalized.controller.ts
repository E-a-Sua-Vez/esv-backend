import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';
import { FormPersonalized } from './model/form-personalized.entity';
import { FormPersonalizedService } from './form-personalized.service';

@Controller('form-personalized')
export class FormPersonalizedController {
    constructor(private readonly formPersonalizedService: FormPersonalizedService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getFormPersonalizedById(@Param() params: any): Promise<FormPersonalized> {
        const { id } = params;
        return this.formPersonalizedService.getFormPersonalizedById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getFormsPersonalized(): Promise<FormPersonalized[]> {
        return this.formPersonalizedService.getFormsPersonalized();
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId')
    public async getFormsPersonalizedByCommerceId(@Param() params: any): Promise<FormPersonalized[]> {
        const { commerceId } = params;
        return this.formPersonalizedService.getFormsPersonalizedByCommerceId(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/queueId/:queueId')
    public async getFormsPersonalizedByQueueId(@Param() params: any): Promise<FormPersonalized[]> {
        const { commerceId, queueId } = params;
        return this.formPersonalizedService.getFormsPersonalizedByQueueId(commerceId, queueId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/type/:type')
    public async getFormsPersonalizedByCommerceIdAndType(@Param() params: any): Promise<FormPersonalized[]> {
        const { commerceId, type } = params;
        return this.formPersonalizedService.getFormsPersonalizedByCommerceIdAndType(commerceId, type);
    }

    @UseGuards(AuthGuard)
    @Post()
    public async createFormPersonalized(@Body() body: any): Promise<FormPersonalized> {
        const { commerceId, type, questions, queueId, servicesId } = body;
        return this.formPersonalizedService.createFormPersonalized(commerceId, type, questions, queueId, servicesId);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateFormPersonalized(@User() user, @Param() params: any, @Body() body: FormPersonalized): Promise<FormPersonalized> {
        const { id } = params;
        const { type, active, available, questions, queueId, servicesId } = body;
        return this.formPersonalizedService.updateFormPersonalized(user, type, id, active, available, questions, queueId, servicesId);
    }
}