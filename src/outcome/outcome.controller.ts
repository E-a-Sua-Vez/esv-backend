import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { OutcomeService } from './outcome.service';
import { Outcome } from './model/outcome.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('outcome')
export class OutcomeController {
    constructor(private readonly outcomeService: OutcomeService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getOutcomeById(@Param() params: any): Promise<Outcome> {
        const { id } = params;
        return this.outcomeService.getOutcomeById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getOutcomes(): Promise<Outcome[]> {
        return this.outcomeService.getOutcomes();
    }

    @UseGuards(AuthGuard)
    @Get('/commerce/:commerceId')
    public async getOutcomeByCommerce(@Param() params: any): Promise<Outcome[]> {
        const { commerceId } = params;
        return this.outcomeService.getOutcomeByCommerce(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/packageId/:packageId')
    public async getPendingOutcomeByPackage(@Param() params: any): Promise<Outcome[]> {
        const { commerceId, packageId } = params;
        return this.outcomeService.getPendingOutcomeByPackage(commerceId, packageId);
    }

    @UseGuards(AuthGuard)
    @Get('/list/:ids')
    public async getOutcomesById(@Param() params: any): Promise<Outcome[]> {
        const { ids } = params;
        return this.outcomeService.getOutcomesById(ids.split(','));
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createOutcome(@User() user, @Body() body: Outcome): Promise<Outcome> {
        const { commerceId, bookingId, attentionId, clientId, type, amount, totalAmount, installments, paymentMethod, outcomeInfo, status, packageId,
            commission, comment, fiscalNote, promotionalCode, transactionId, bankEntity, paymentType, paymentAmount, quantity, title, productId, productName, beneficiary, date, code, expireDate } = body;
        return this.outcomeService.createOutcome(user, commerceId, type, status, bookingId, attentionId, clientId, packageId, amount, totalAmount, installments,
            paymentMethod, commission, comment, fiscalNote, promotionalCode, transactionId, bankEntity, outcomeInfo, paymentType, paymentAmount, quantity, title, productId, productName, beneficiary, date, code, expireDate);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateOutcome(@User() user, @Param() params: any, @Body() body: Outcome): Promise<Outcome> {
        const { id } = params;
        const { outcomeInfo, paymentConfirmation, status } = body;
        return this.outcomeService.updateOutcomeConfigurations(user, id, outcomeInfo, paymentConfirmation, status);
    }
}