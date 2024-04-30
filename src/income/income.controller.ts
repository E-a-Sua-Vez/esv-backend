import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IncomeService } from './income.service';
import { Income } from './model/income.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('income')
export class IncomeController {
    constructor(private readonly incomeService: IncomeService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getIncomeById(@Param() params: any): Promise<Income> {
        const { id } = params;
        return this.incomeService.getIncomeById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getIncomes(): Promise<Income[]> {
        return this.incomeService.getIncomes();
    }

    @UseGuards(AuthGuard)
    @Get('/commerce/:commerceId')
    public async getIncomeByCommerce(@Param() params: any): Promise<Income[]> {
        const { commerceId } = params;
        return this.incomeService.getIncomeByCommerce(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/packageId/:packageId')
    public async getPendingIncomeByPackage(@Param() params: any): Promise<Income[]> {
        const { commerceId, packageId } = params;
        return this.incomeService.getPendingIncomeByPackage(commerceId, packageId);
    }

    @UseGuards(AuthGuard)
    @Get('/list/:ids')
    public async getIncomesById(@Param() params: any): Promise<Income[]> {
        const { ids } = params;
        return this.incomeService.getIncomesById(ids.split(','));
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createIncome(@User() user, @Body() body: Income): Promise<Income> {
        const { commerceId, bookingId, attentionId, clientId, type, amount, totalAmount, installments, paymentMethod, incomeInfo, status, packageId,
            commission, comment, fiscalNote, promotionalCode, transactionId, bankEntity } = body;
        return this.incomeService.createIncome(user, commerceId, type, status, bookingId, attentionId, clientId, packageId, amount, totalAmount, installments,
            paymentMethod, commission, comment, fiscalNote, promotionalCode, transactionId, bankEntity, incomeInfo);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateIncome(@User() user, @Param() params: any, @Body() body: Income): Promise<Income> {
        const { id } = params;
        const { incomeInfo, paymentConfirmation, status } = body;
        return this.incomeService.updateIncomeConfigurations(user, id, incomeInfo, paymentConfirmation, status);
    }

    @UseGuards(AuthGuard)
    @Patch('/confirm/:id')
    public async confirmPendingIncome(@User() user, @Param() params: any): Promise<Income> {
        const { id } = params;
        return this.incomeService.confirmPendingIncome(user, id);
    }
}