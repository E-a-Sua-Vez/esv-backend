import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

import { Payment } from './model/payment.entity';
import { PaymentService } from './payment.service';

@ApiTags('payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get payment by ID',
    description: 'Retrieves a payment by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Payment ID', example: 'payment-123' })
  @ApiResponse({ status: 200, description: 'Payment found', type: Payment })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  public async getPaymentById(@Param() params: any): Promise<Payment> {
    const { id } = params;
    return this.paymentService.getPaymentById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new payment', description: 'Creates a new payment record' })
  @ApiBody({ type: Payment })
  @ApiResponse({ status: 201, description: 'Payment created successfully', type: Payment })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createPayment(@User() user, @Body() body: Payment): Promise<Payment> {
    const { businessId, planId, amount, paymentNumber, paymentDate, bankData, method } = body;
    return this.paymentService.createPayment(
      user,
      businessId,
      planId,
      amount,
      paymentNumber,
      paymentDate,
      bankData,
      method
    );
  }
}
