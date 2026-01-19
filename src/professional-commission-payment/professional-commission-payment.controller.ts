import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';

import { ProfessionalCommissionPaymentService } from './professional-commission-payment.service';
import { CommissionPaymentStatus } from './model/commission-payment-status.enum';
import { PaymentMethod } from '../payment/model/payment-method.enum';

@Controller('professional-commission-payment')
export class ProfessionalCommissionPaymentController {
  constructor(
    private professionalCommissionPaymentService: ProfessionalCommissionPaymentService
  ) {}

  // Rutas específicas primero (antes de las rutas con parámetros genéricos)
  @UseGuards(AuthGuard)
  @Get('unpaid/professional/:professionalId')
  async getUnpaidIncomesByProfessional(
    @Param() params: any,
    @Query('commerceId') commerceId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const { professionalId } = params;
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    return await this.professionalCommissionPaymentService.getUnpaidIncomesByProfessional(
      professionalId,
      commerceId,
      fromDate,
      toDate
    );
  }

  @UseGuards(AuthGuard)
  @Get('commerce/:commerceId/status/:status')
  async getCommissionPaymentsByStatus(@Param() params: any) {
    const { commerceId, status } = params;
    return await this.professionalCommissionPaymentService.getCommissionPaymentsByStatus(
      commerceId,
      status as CommissionPaymentStatus
    );
  }

  @UseGuards(AuthGuard)
  @Get('commerce/:commerceId')
  async getCommissionPaymentsByCommerce(@Param() params: any) {
    const { commerceId } = params;
    return await this.professionalCommissionPaymentService.getCommissionPaymentsByCommerce(
      commerceId
    );
  }

  @UseGuards(AuthGuard)
  @Get('professional/:professionalId')
  async getCommissionPaymentsByProfessional(@Param() params: any) {
    const { professionalId } = params;
    return await this.professionalCommissionPaymentService.getCommissionPaymentsByProfessional(
      professionalId
    );
  }

  // Ruta genérica al final
  @UseGuards(AuthGuard)
  @Get(':id')
  async getCommissionPaymentById(@Param() params: any) {
    const { id } = params;
    return await this.professionalCommissionPaymentService.getCommissionPaymentById(id);
  }

  @UseGuards(AuthGuard)
  @Post()
  async createCommissionPayment(
    @Headers('user') user: string,
    @Body()
    body: {
      commerceId: string;
      businessId: string;
      professionalId: string;
      incomeIds: string[];
      periodFrom: string;
      periodTo: string;
      notes?: string;
    }
  ) {
    const { commerceId, businessId, professionalId, incomeIds, periodFrom, periodTo, notes } = body;

    return await this.professionalCommissionPaymentService.createCommissionPayment(
      user,
      commerceId,
      businessId,
      professionalId,
      incomeIds,
      new Date(periodFrom),
      new Date(periodTo),
      notes
    );
  }

  @UseGuards(AuthGuard)
  @Patch(':id')
  async updateCommissionPayment(
    @Headers('user') user: string,
    @Param() params: any,
    @Body()
    body: {
      incomeIdsToAdd?: string[];
      incomeIdsToRemove?: string[];
      notes?: string;
    }
  ) {
    const { id } = params;
    const { incomeIdsToAdd, incomeIdsToRemove, notes } = body;

    return await this.professionalCommissionPaymentService.updateCommissionPayment(
      user,
      id,
      incomeIdsToAdd,
      incomeIdsToRemove,
      notes
    );
  }

  @UseGuards(AuthGuard)
  @Post(':id/confirm')
  async confirmCommissionPayment(
    @Headers('user') user: string,
    @Param() params: any,
    @Body()
    body: {
      paymentMethod: PaymentMethod;
      paymentNotes?: string;
    }
  ) {
    const { id } = params;
    const { paymentMethod, paymentNotes } = body;

    return await this.professionalCommissionPaymentService.confirmCommissionPayment(
      user,
      id,
      paymentMethod,
      paymentNotes
    );
  }

  @UseGuards(AuthGuard)
  @Post(':id/cancel')
  async cancelCommissionPayment(
    @Headers('user') user: string,
    @Param() params: any,
    @Body() body: { reason: string }
  ) {
    const { id } = params;
    const { reason } = body;

    return await this.professionalCommissionPaymentService.cancelCommissionPayment(
      user,
      id,
      reason
    );
  }
}
