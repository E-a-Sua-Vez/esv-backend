import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from 'nestjs-fireorm';
import { IRepository } from 'fireorm';
import { publish } from 'ett-events-lib';
import { CreateRefundDto, RefundType, RefundReason } from '../dto/create-refund.dto';
import { RefundResponse, ProcessRefundResult } from '../interfaces/refund.interfaces';
import { Outcome } from '../../../outcome/model/outcome.entity';
import { OutcomeStatus } from '../../../outcome/model/outcome-status.enum';
import { Income } from '../../../income/model/income.entity';
import { IncomeService } from '../../../income/income.service';
import { OutcomeService } from '../../../outcome/outcome.service';
import { RefundProcessed } from '../events/refund-processed.event';
import { RefundApproved } from '../events/refund-approved.event';
import { RefundRejected } from '../events/refund-rejected.event';

@Injectable()
export class RefundService {
  constructor(
    @InjectRepository(Outcome)
    private outcomeRepository: IRepository<Outcome>,
    @InjectRepository(Income)
    private incomeRepository: IRepository<Income>,
    private incomeService: IncomeService,
    private outcomeService: OutcomeService,
    // private eventsService: EventsService
  ) {}

  async processRefund(createRefundDto: CreateRefundDto, commerceId: string): Promise<ProcessRefundResult> {
    // 1. Validar transacción original
    const originalTransaction = await this.findOriginalTransaction(
      createRefundDto.originalTransactionId,
      commerceId
    );

    if (!originalTransaction) {
      throw new NotFoundException('Transacción original no encontrada');
    }

    // 2. Validar monto del refund
    await this.validateRefundAmount(createRefundDto, originalTransaction);

    // 3. Crear registro del refund como outcome
    const refundOutcome = await this.createRefundOutcome(createRefundDto, commerceId, originalTransaction);

    // 4. Procesar reversión automática de comisión si aplica
    await this.processCommissionReversal(createRefundDto, originalTransaction);

    // 5. Enviar evento para notificaciones y auditoría
    const event = new RefundProcessed(
      new Date(),
      refundOutcome.id,
      createRefundDto.originalTransactionId,
      refundOutcome.amount,
      refundOutcome.conceptType,
      commerceId,
      refundOutcome.clientId,
      refundOutcome.beneficiary,
      createRefundDto.reason || '',
      { refundOutcome, originalTransaction }
    );
    await publish(event);

    return {
      success: true,
      refundId: refundOutcome.id,
      transactionId: refundOutcome.id,
    };
  }

  async getRefunds(
    commerceId: string,
    options: { page: number; limit: number; type?: string; status?: string }
  ): Promise<{ refunds: RefundResponse[]; total: number; page: number; limit: number }> {
    // Usar Fireorm en lugar de QueryBuilder
    let query = this.outcomeRepository
      .whereEqualTo('commerceId', commerceId)
      .orderByDescending('createdAt');

    // Filtrar por tipo si se especifica
    if (options.type) {
      query = query.whereEqualTo('conceptType', options.type);
    }

    const allOutcomes = await query.find();

    // Filtrar refunds manualmente (Fireorm no tiene LIKE)
    const refundOutcomes = allOutcomes.filter(outcome =>
      outcome.conceptType?.includes('refund') ||
      outcome.description?.toLowerCase().includes('reembolso')
    );

    // Aplicar paginación
    const start = (options.page - 1) * options.limit;
    const end = start + options.limit;
    const paginatedOutcomes = refundOutcomes.slice(start, end);

    const refunds: RefundResponse[] = paginatedOutcomes.map(outcome => ({
      id: outcome.id,
      originalTransactionId: outcome.auxiliaryId || '',
      amount: outcome.amount,
      type: outcome.conceptType,
      reason: outcome.description || '',
      description: outcome.description,
      clientId: outcome.clientId,
      professionalId: outcome.beneficiary, // Usar beneficiary en lugar de professionalId
      status: outcome.status || 'processed',
      processedAt: outcome.createdAt,
      createdAt: outcome.createdAt,
      commerceId: outcome.commerceId,
    }));

    return {
      refunds,
      total: refundOutcomes.length,
      page: options.page,
      limit: options.limit,
    };
  }

  async getRefundById(refundId: string, commerceId: string): Promise<RefundResponse> {
    const outcome = await this.outcomeRepository.findById(refundId);

    if (!outcome || outcome.commerceId !== commerceId) {
      throw new NotFoundException('Reembolso no encontrado');
    }

    return {
      id: outcome.id,
      originalTransactionId: outcome.auxiliaryId || '',
      amount: outcome.amount,
      type: outcome.conceptType,
      reason: outcome.description || '',
      description: outcome.description,
      clientId: outcome.clientId,
      professionalId: outcome.beneficiary, // Usar beneficiary en lugar de professionalId
      status: outcome.status || 'processed',
      processedAt: outcome.createdAt,
      createdAt: outcome.createdAt,
      commerceId: outcome.commerceId,
    };
  }

  async approveRefund(refundId: string, commerceId: string): Promise<{ success: boolean; message: string }> {
    const outcome = await this.outcomeRepository.findById(refundId);

    if (!outcome || outcome.commerceId !== commerceId) {
      throw new NotFoundException('Reembolso no encontrado');
    }

    outcome.status = 'approved' as any;
    await this.outcomeRepository.update(outcome);

    const event = new RefundApproved(
      new Date(),
      refundId,
      commerceId,
      outcome.amount,
      { outcome }
    );
    await publish(event);

    return {
      success: true,
      message: 'Reembolso aprobado exitosamente',
    };
  }

  async rejectRefund(refundId: string, commerceId: string, reason: string): Promise<{ success: boolean; message: string }> {
    const outcome = await this.outcomeRepository.findById(refundId);

    if (!outcome || outcome.commerceId !== commerceId) {
      throw new NotFoundException('Reembolso no encontrado');
    }

    outcome.status = 'rejected' as any;
    outcome.description += ` - Rechazado: ${reason}`;
    await this.outcomeRepository.update(outcome);

    const event = new RefundRejected(
      new Date(),
      refundId,
      commerceId,
      outcome.amount,
      reason,
      { outcome }
    );
    await publish(event);

    return {
      success: true,
      message: 'Reembolso rechazado exitosamente',
    };
  }

  private async findOriginalTransaction(transactionId: string, commerceId: string) {
    // Buscar en ingresos
    let transaction = await this.incomeRepository.findById(transactionId);

    if (transaction && transaction.commerceId === commerceId) {
      return { type: 'income', data: transaction };
    }

    // Buscar en egresos
    const outcome = await this.outcomeRepository.findById(transactionId);

    if (outcome && outcome.commerceId === commerceId) {
      return { type: 'outcome', data: outcome };
    }

    return null;
  }

  private async validateRefundAmount(createRefundDto: CreateRefundDto, originalTransaction: any) {
    const originalAmount = originalTransaction.data.amount || originalTransaction.data.paymentAmount;

    if (createRefundDto.amount > originalAmount) {
      throw new BadRequestException(
        `El monto del reembolso (${createRefundDto.amount}) no puede ser mayor al monto original (${originalAmount})`
      );
    }

    // Verificar refunds previos usando Fireorm
    const allOutcomes = await this.outcomeRepository
      .whereEqualTo('auxiliaryId', createRefundDto.originalTransactionId)
      .find();

    const previousRefunds = allOutcomes.filter(outcome =>
      outcome.conceptType?.includes('refund')
    );

    const totalRefunded = previousRefunds.reduce((sum, refund) => sum + refund.amount, 0);

    if (totalRefunded + createRefundDto.amount > originalAmount) {
      throw new BadRequestException(
        `El monto total de reembolsos (${totalRefunded + createRefundDto.amount}) no puede exceder el monto original (${originalAmount})`
      );
    }
  }

  private async createRefundOutcome(createRefundDto: CreateRefundDto, commerceId: string, originalTransaction: any): Promise<Outcome> {
    // Crear outcome con todos los campos requeridos
    const refundOutcome = new Outcome();
    refundOutcome.commerceId = commerceId;
    refundOutcome.amount = createRefundDto.amount;
    refundOutcome.totalAmount = createRefundDto.amount;
    refundOutcome.conceptType = createRefundDto.type;
    refundOutcome.description = this.buildRefundDescription(createRefundDto);
    refundOutcome.clientId = createRefundDto.clientId || originalTransaction.data.clientId;
    refundOutcome.beneficiary = createRefundDto.professionalId || originalTransaction.data.professionalId || '';
    refundOutcome.auxiliaryId = createRefundDto.originalTransactionId;
    refundOutcome.type = 'OTHER';
    refundOutcome.status = OutcomeStatus.CONFIRMED;
    refundOutcome.createdAt = new Date();
    refundOutcome.bookingId = '';
    refundOutcome.attentionId = '';
    refundOutcome.packageId = '';
    refundOutcome.installments = 0;
    refundOutcome.commission = 0;
    refundOutcome.paid = false;

    return await this.outcomeRepository.create(refundOutcome);
  }

  private buildRefundDescription(createRefundDto: CreateRefundDto): string {
    const reasonMap = {
      [RefundReason.CUSTOMER_REQUEST]: 'Solicitud del cliente',
      [RefundReason.SERVICE_ISSUE]: 'Problema con el servicio',
      [RefundReason.TECHNICAL_ERROR]: 'Error técnico',
      [RefundReason.DUPLICATE_PAYMENT]: 'Pago duplicado',
      [RefundReason.POLICY_VIOLATION]: 'Violación de políticas',
      [RefundReason.OTHER]: 'Otro motivo',
    };

    let description = `Reembolso - ${reasonMap[createRefundDto.reason]}`;

    if (createRefundDto.description) {
      description += ` - ${createRefundDto.description}`;
    }

    return description;
  }

  private async processCommissionReversal(createRefundDto: CreateRefundDto, originalTransaction: any) {
    // Solo procesar reversión para refunds de payment de incomes
    if (createRefundDto.type !== 'payment-refund' || originalTransaction.type !== 'income') {
      return;
    }

    const income = originalTransaction.data as Income;
    let incomeUpdated = false;

    // Verificar si ya se pagó comisión
    if (income.commissionPaid === true && income.professionalCommission && income.professionalCommission > 0) {
      try {
        // Crear outcome para revertir la comisión pagada
        await this.createCommissionReversalOutcome(income, createRefundDto.amount);

        // Marcar la comisión como no pagada para evitar futuros pagos
        income.commissionPaid = false;
        income.commissionPaymentId = null; // Limpiar referencia al pago de comisión
        incomeUpdated = true;

        console.log(`[RefundService] Comisión revertida automáticamente para income ${income.id}`);
      } catch (error) {
        console.error(`[RefundService] Error al revertir comisión para income ${income.id}:`, error);
        // No fallar el refund por error en la reversión de comisión
      }
    }

    // Marcar el income como refunded (parcial o total)
    try {
      // Calcular total refunded incluyendo este refund
      const totalRefunded = createRefundDto.amount;
      const originalAmount = income.amount || income.totalAmount || 0;

      // Marcar como refunded si se reembolsa el total o agregar metadata
      if (!income.refundMetadata) {
        income.refundMetadata = {
          isRefunded: true,
          refundedAmount: totalRefunded,
          refundDate: new Date(),
          isPartialRefund: totalRefunded < originalAmount
        };
      }

      incomeUpdated = true;
    } catch (error) {
      console.error(`[RefundService] Error al marcar income como refunded:`, error);
    }

    // Actualizar el income si hubo cambios
    if (incomeUpdated) {
      await this.incomeService.updateIncome('system-refund', income);
    }
  }

  private async createCommissionReversalOutcome(income: Income, refundAmount: number): Promise<Outcome> {
    const commissionAmount = income.professionalCommission;

    // Calcular proporción de comisión a revertir basado en el monto del refund
    const refundProportion = refundAmount / (income.amount || income.totalAmount || refundAmount);
    const commissionToRevert = commissionAmount * refundProportion;

    // Crear outcome completo con todos los campos requeridos
    const reversalOutcome = new Outcome();
    reversalOutcome.commerceId = income.commerceId;
    reversalOutcome.amount = commissionToRevert;
    reversalOutcome.totalAmount = commissionToRevert;
    reversalOutcome.conceptType = 'commission-reversal';
    reversalOutcome.description = `Reversión automática de comisión - Refund de ${refundAmount}`;
    reversalOutcome.clientId = income.clientId;
    reversalOutcome.beneficiary = income.professionalId;
    reversalOutcome.auxiliaryId = income.id;
    reversalOutcome.type = 'PROFESSIONAL_COMMISSION';
    reversalOutcome.status = OutcomeStatus.CONFIRMED;
    reversalOutcome.createdAt = new Date();
    reversalOutcome.bookingId = '';
    reversalOutcome.attentionId = '';
    reversalOutcome.packageId = '';
    reversalOutcome.installments = 0;
    reversalOutcome.commission = 0;
    reversalOutcome.paid = false;

    return await this.outcomeRepository.create(reversalOutcome);
  }

  private async sendRefundEvent(refundOutcome: Outcome, originalTransaction: any) {
    // await this.eventsService.send('refund.processed', {
    //   refundId: refundOutcome.id,
    //   originalTransactionId: originalTransaction.data.id,
    //   amount: refundOutcome.amount,
    //   type: refundOutcome.conceptType,
    //   commerceId: refundOutcome.commerceId,
    //   clientId: refundOutcome.clientId,
    //   professionalId: refundOutcome.professionalId,
    //   processedAt: refundOutcome.createdAt,
    // });
  }
}