import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PatientHistoryService } from './patient-history.service';
import { PatientHistory } from './model/patient-history.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';
import { PatientHistoryUpdateDto } from './dto/patient-history-update.dto';

@Controller('patient-history')
export class PatientHistoryController {
    constructor(private readonly patientHistoryService: PatientHistoryService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getPatientHistoryById(@Param() params: any): Promise<PatientHistory> {
        const { id } = params;
        return this.patientHistoryService.getPatientHistoryById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getAllPatientHistory(): Promise<PatientHistory[]> {
        return this.patientHistoryService.getAllPatientHistory();
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId')
    public async getPatientHistorysByCommerceId(@Param() params: any): Promise<PatientHistory[]> {
        const { commerceId } = params;
        return this.patientHistoryService.getPatientHistorysByCommerceId(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/active')
    public async getActivePatientHistorysByCommerceId(@Param() params: any): Promise<PatientHistory[]> {
        const { commerceId } = params;
        return this.patientHistoryService.getActivePatientHistorysByCommerceId(commerceId);
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createPatientHistory(@User() user, @Body() body: PatientHistory): Promise<PatientHistory> {
        const { commerceId, clientId, type, personalData, consultationReason, currentIllness,
            personalBackground, familyBackground, psychobiologicalHabits, functionalExam,
            physicalExam, diagnostic, medicalOrder, control, aditionalInfo, lastAttentionId} = body;
        return this.patientHistoryService.createPatientHistory(
            user, commerceId, clientId,
            type, personalData, consultationReason, currentIllness,
            personalBackground, familyBackground, psychobiologicalHabits, functionalExam,
            physicalExam, diagnostic, medicalOrder, control, aditionalInfo, lastAttentionId);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updatePatientHistoryConfigurations(@User() user, @Param() params: any, @Body() body: PatientHistoryUpdateDto): Promise<PatientHistory> {
        const { id } = params;
        const { personalData, consultationReason, currentIllness,
            personalBackground, familyBackground, psychobiologicalHabits, functionalExam,
            physicalExam, diagnostic, medicalOrder, control, aditionalInfo, active, available, lastAttentionId } = body;
        return this.patientHistoryService.updatePatientHistoryConfigurations(user, id, personalData, consultationReason, currentIllness,
            personalBackground, familyBackground, psychobiologicalHabits, functionalExam, physicalExam, diagnostic, medicalOrder, control, aditionalInfo, active, available, lastAttentionId);
    }

    @UseGuards(AuthGuard)
    @Patch('/control/:id')
    public async updatePatientHistoryControl(@User() user, @Param() params: any, @Body() body: PatientHistory): Promise<PatientHistory> {
        const { id } = params;
        const { control, lastAttentionId } = body;
        return this.patientHistoryService.updatePatientHistoryControl(user, id, control, lastAttentionId);
    }

    @UseGuards(AuthGuard)
    @Post('/save')
    public async savePatientHistory(@User() user, @Body() body: PatientHistoryUpdateDto): Promise<PatientHistory> {
        const { commerceId, clientId, type, personalData, consultationReason, currentIllness,
            personalBackground, familyBackground, psychobiologicalHabits, functionalExam,
            physicalExam, diagnostic, medicalOrder, control, aditionalInfo, lastAttentionId, active, available} = body;
        return this.patientHistoryService.savePatientHistory(
            user, commerceId, clientId, type, personalData, consultationReason, currentIllness,
            personalBackground, familyBackground, psychobiologicalHabits, functionalExam,
            physicalExam, diagnostic, medicalOrder, control, aditionalInfo, active, available, lastAttentionId);
    }
}