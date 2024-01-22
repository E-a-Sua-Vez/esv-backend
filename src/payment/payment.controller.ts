import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Payment } from './model/payment.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('payment')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getPaymentById(@Param() params: any): Promise<Payment> {
        const { id } = params;
        return this.paymentService.getPaymentById(id);
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createPayment(@User() user, @Body() body: Payment): Promise<Payment> {
        const { businessId, planId, amount, paymentNumber, paymentDate, bankData, method } = body;
        return this.paymentService.createPayment(user, businessId, planId, amount, paymentNumber, paymentDate, bankData, method);
    }
}