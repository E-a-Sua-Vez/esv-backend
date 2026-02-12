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

  async processRefund(createRefundDto: CreateRefundDto, userCommerceId?: string): Promise<ProcessRefundResult> {
    // 1. Buscar la transacción original primero (sin filtrar por commerceId)
    const originalTransaction = await this.findOriginalTransaction(
      createRefundDto.originalTransactionId
    );

    if (!originalTransaction) {
      throw new NotFoundException(
        `Transacción original no encontrada. ID: ${createRefundDto.originalTransactionId}`
      );
    }

    // 2. Usar el commerceId de la transacción original
    const commerceId = originalTransaction.data.commerceId;

    if (!commerceId) {
      throw new NotFoundException(
        `La transacción original no tiene commerceId asociado. ID: ${createRefundDto.originalTransactionId}`
      );
    }

    // 3. Validar monto del refund
    await this.validateRefundAmount(createRefundDto, originalTransaction);

    // 4. Crear registro del refund como outcome
    const refundOutcome = await this.createRefundOutcome(createRefundDto, commerceId, originalTransaction);

    // 5. Procesar reversión automática de comisión si aplica
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
      refundOutcome.beneficiaryName || '',
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

  private async findOriginalTransaction(transactionId: string) {
    try {
      // Buscar en ingresos
      const income = await this.incomeRepository.findById(transactionId);

      if (income) {
        return { type: 'income', data: income };
      }
    } catch (error) {
      // Si falla la búsqueda en income, continuar con outcome
      console.log(`Income not found: ${transactionId}`);
    }

    try {
      // Buscar en egresos
      const outcome = await this.outcomeRepository.findById(transactionId);

      if (outcome) {
        return { type: 'outcome', data: outcome };
      }
    } catch (error) {
      // Si falla la búsqueda en outcome, retornar null
      console.log(`Outcome not found: ${transactionId}`);
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
    // Obtener nombre del beneficiario del income original
    let beneficiaryName = '';
    if (originalTransaction.type === 'income') {
      const income = originalTransaction.data as Income;
      beneficiaryName = income.professionalName || '';
    }

    // Crear outcome con todos los campos requeridos
    const refundOutcome = new Outcome();
    refundOutcome.commerceId = commerceId;
    refundOutcome.amount = createRefundDto.amount;
    refundOutcome.totalAmount = createRefundDto.amount;
    refundOutcome.conceptType = createRefundDto.type;
    refundOutcome.description = this.buildRefundDescription(createRefundDto);
    refundOutcome.clientId = createRefundDto.clientId || originalTransaction.data.clientId;
    refundOutcome.beneficiary = createRefundDto.professionalId || originalTransaction.data.professionalId || '';
    refundOutcome.beneficiaryName = beneficiaryName;
    refundOutcome.auxiliaryId = createRefundDto.originalTransactionId;
    refundOutcome.type = 'payment-refund';
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

    // Calcular total refunded (previos + actual)
    const allOutcomes = await this.outcomeRepository
      .whereEqualTo('auxiliaryId', income.id)
      .find();
    const previousRefunds = allOutcomes.filter(outcome =>
      outcome.conceptType?.includes('refund')
    );
    const previousRefundedAmount = previousRefunds.reduce((sum, refund) => sum + refund.amount, 0);
    const totalRefunded = previousRefundedAmount + createRefundDto.amount;
    const originalAmount = income.amount || income.totalAmount || 0;

    // Verificar si ya se pagó comisión
    if (income.commissionPaid === true && income.professionalCommission && income.professionalCommission > 0) {
      try {
        // Crear outcome para revertir la comisión pagada (proporcional al refund)
        await this.createCommissionReversalOutcome(income, createRefundDto.amount);

        // Si es reembolso total, marcar comisión como no pagada
        if (totalRefunded >= originalAmount) {
          income.commissionPaid = false;
          income.commissionPaymentId = null;
        }

        incomeUpdated = true;
      } catch (error) {
        console.error(`[RefundService] Error al revertir comisión para income ${income.id}:`, error);
        // No fallar el refund por error en la reversión de comisión
      }
    } else if (income.professionalCommission && income.professionalCommission > 0) {
      // Comisión NO pagada aún - marcar que no debe pagarse si hay refund
      // Esto previene que aparezca en reportes de comisiones pendientes
      income.commissionPaid = false;
      income.commissionPaymentId = null;
      incomeUpdated = true;
    }

    // Marcar el income como refunded (parcial o total)
    try {
      // Actualizar metadata con el total acumulado
      income.refundMetadata = {
        isRefunded: true,
        refundedAmount: totalRefunded,
        refundDate: new Date(),
        isPartialRefund: totalRefunded < originalAmount,
        originalAmount: originalAmount
      };

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
    reversalOutcome.type = 'commission-reversal';
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