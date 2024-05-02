import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PatientHistoryItemService } from './patient-history-item.service';
import { PatientHistoryItem } from './model/patient-history-item.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('patient-history-item')
export class PatientHistoryItemController {
    constructor(private readonly moduleService: PatientHistoryItemService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getPatientHistoryItemById(@Param() params: any): Promise<PatientHistoryItem> {
        const { id } = params;
        return this.moduleService.getPatientHistoryItemById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getAllPatientHistoryItem(): Promise<PatientHistoryItem[]> {
        return this.moduleService.getAllPatientHistoryItem();
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId')
    public async getPatientHistoryItemsByCommerceId(@Param() params: any): Promise<PatientHistoryItem[]> {
        const { commerceId } = params;
        return this.moduleService.getPatientHistoryItemsByCommerceId(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/active')
    public async getActivePatientHistoryItemsByCommerceId(@Param() params: any): Promise<PatientHistoryItem[]> {
        const { commerceId } = params;
        return this.moduleService.getActivePatientHistoryItemsByCommerceId(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/type/:type')
    public async getActivePatientHistoryItemsByCommerceIdAndType(@Param() params: any): Promise<PatientHistoryItem[]> {
        const { commerceId, type } = params;
        return this.moduleService.getActivePatientHistoryItemsByCommerceIdAndType(commerceId, type);
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createPatientHistoryItem(@User() user, @Body() body: PatientHistoryItem): Promise<PatientHistoryItem> {
        const { commerceId, name } = body;
        return this.moduleService.createPatientHistoryItem(user, commerceId, name);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updatePatientHistoryItemConfigurations(@User() user, @Param() params: any, @Body() body: PatientHistoryItem): Promise<PatientHistoryItem> {
        const { id } = params;
        const { name, active, available } = body;
        return this.moduleService.updatePatientHistoryItemConfigurations(user, id, name, active, available);
    }
}