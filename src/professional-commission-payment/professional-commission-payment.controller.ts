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
  Res,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { Response } from 'express';

import { ProfessionalCommissionPaymentService } from './professional-commission-payment.service';
import { ProfessionalCommissionPaymentPdfService } from './professional-commission-payment-pdf.service';
import { CommissionPaymentStatus } from './model/commission-payment-status.enum';
import { PaymentMethod } from '../payment/model/payment-method.enum';

@Controller('professional-commission-payment')
export class ProfessionalCommissionPaymentController {
  private readonly logger = new Logger(ProfessionalCommissionPaymentController.name);

  constructor(
    private professionalCommissionPaymentService: ProfessionalCommissionPaymentService,
    private commissionPaymentPdfService: ProfessionalCommissionPaymentPdfService
  ) {
    this.logger.log('ProfessionalCommissionPaymentController initialized');
  }

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

  // Ruta específica para PDF - debe estar ANTES de la ruta genérica :id
  // Usando el mismo patrón que otros controladores: /:id/pdf
  @UseGuards(AuthGuard)
  @Get(':id/pdf')
  @HttpCode(HttpStatus.OK)
  async downloadCommissionPaymentPdf(
    @Param('id') id: string,
    @Query('commerceId') commerceId: string,
    @Res() res: Response
  ): Promise<void> {
    try {
      this.logger.log(`Downloading PDF for commission payment: ${id}`);
      const payment = await this.professionalCommissionPaymentService.getCommissionPaymentById(id);

      if (!payment) {
        this.logger.warn(`Commission payment not found: ${id}`);
        res.status(404).json({
          statusCode: 404,
          message: 'Commission payment not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      this.logger.log(`[PDF Controller] Generating PDF stream for payment: ${id}, commerce: ${commerceId || payment.commerceId}`);

      // Agregar timestamp único al nombre del archivo para evitar caché del navegador
      const timestamp = Date.now();
      const pdfStream = await this.commissionPaymentPdfService.getCommissionPaymentPdf(
        id,
        commerceId || payment.commerceId
      );

      // Headers para PROHIBIR cualquier tipo de caché
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="commission-payment-${id}-${timestamp}.pdf"`
      );
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Generated-At', new Date().toISOString());
      res.setHeader('X-Timestamp', timestamp.toString());

      this.logger.log(`[PDF Controller] Streaming PDF with no-cache headers (timestamp: ${timestamp})`);
      pdfStream.pipe(res);
    } catch (error) {
      this.logger.error(`Error downloading PDF: ${error.message}`, error.stack);
      if (!res.headersSent) {
        res.status(500).json({
          statusCode: 500,
          message: `Error generating PDF: ${error.message}`,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Ruta genérica al final - IMPORTANTE: debe estar después de todas las rutas específicas
  @UseGuards(AuthGuard)
  @Get(':id')
  async getCommissionPaymentById(@Param('id') id: string) {
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
