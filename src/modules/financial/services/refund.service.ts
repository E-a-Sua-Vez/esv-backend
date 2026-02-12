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
import IncomeUpdated from '../../../income/events/IncomeUpdated';

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

  /**
   * 🔄 FILTRO ESTÁNDAR PARA REFUNDS - Usar en TODAS las funciones
   * Esta lógica debe coincidir EXACTAMENTE con query stack
   */
  private isRefundOrCommissionReversal(outcome: any): boolean {
    const conceptType = outcome.conceptType || outcome.type || '';
    return (
      conceptType.includes('refund') ||
      conceptType === 'commission-reversal'
    );
  }

  async processRefund(createRefundDto: CreateRefundDto, userCommerceId?: string): Promise<ProcessRefundResult> {
    console.log('[RefundService] Starting processRefund with data:', createRefundDto);
    
    try {
      // 1. Buscar la transacción original primero (sin filtrar por commerceId)
      const originalTransaction = await this.findOriginalTransaction(
        createRefundDto.originalTransactionId
      );

      if (!originalTransaction) {
        throw new NotFoundException(
          `Transacción original no encontrada. ID: ${createRefundDto.originalTransactionId}`
        );
      }

      console.log('[RefundService] Original transaction found:', originalTransaction);

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

      console.log('[RefundService] Refund outcome created successfully:', refundOutcome.id);

      // 5. Actualizar income original con metadata del refund (incluye reversión de comisión)
      await this.updateIncomeWithRefundMetadata(createRefundDto, originalTransaction, refundOutcome.id);

      // 6. Enviar evento para notificaciones y auditoría
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
    } catch (error) {
      console.error('[RefundService] Error processing refund:', error);
      throw error;
    }
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

    // Filtrar refunds usando filtro estándar (consistente con query stack)
    const refundOutcomes = allOutcomes.filter(outcome => 
      this.isRefundOrCommissionReversal(outcome)
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
      this.isRefundOrCommissionReversal(outcome)
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

    console.log('[RefundService] Creating refund outcome with data:', {
      commerceId,
      amount: createRefundDto.amount,
      type: createRefundDto.type,
      originalTransactionId: createRefundDto.originalTransactionId
    });

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
    refundOutcome.type = createRefundDto.type; // Usar el tipo correcto del DTO
    refundOutcome.status = OutcomeStatus.CONFIRMED;
    refundOutcome.createdAt = new Date();
    refundOutcome.createdBy = 'system-refund';
    
    // Campos requeridos adicionales
    refundOutcome.bookingId = '';
    refundOutcome.attentionId = '';
    refundOutcome.packageId = '';
    refundOutcome.installments = 0;
    refundOutcome.commission = 0;
    refundOutcome.paid = false;
    refundOutcome.comment = '';
    refundOutcome.fiscalNote = '';
    refundOutcome.promotionalCode = '';
    refundOutcome.transactionId = '';
    refundOutcome.bankEntity = '';
    refundOutcome.discountAmount = 0;
    refundOutcome.discountPercentage = 0;
    refundOutcome.typeName = 'refund';
    refundOutcome.paymentType = 'refund';
    refundOutcome.paymentAmount = createRefundDto.amount.toString();
    refundOutcome.quantity = '1';
    refundOutcome.title = this.buildRefundDescription(createRefundDto);
    refundOutcome.productId = '';
    refundOutcome.productName = 'Refund';
    refundOutcome.companyBeneficiaryId = '';
    refundOutcome.date = new Date();
    refundOutcome.code = `REF-${Date.now()}`;

    console.log('[RefundService] About to save outcome:', refundOutcome);

    const savedOutcome = await this.outcomeRepository.create(refundOutcome);
    
    console.log('[RefundService] Saved outcome with ID:', savedOutcome.id);
    
    return savedOutcome;
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

  private async updateIncomeWithRefundMetadata(
    createRefundDto: CreateRefundDto, 
    originalTransaction: any, 
    refundId: string
  ) {
    if (originalTransaction.type !== 'income') {
      return;
    }

    const income = originalTransaction.data as Income;
    let incomeUpdated = false;
    
    try {
      console.log('[RefundService] Updating income with refund metadata:', income.id);

      // Calcular totales de refund actuales (incluir commission-reversal)
      const allOutcomes = await this.outcomeRepository
        .whereEqualTo('auxiliaryId', income.id)
        .find();
      const allRefunds = allOutcomes.filter(outcome =>
        this.isRefundOrCommissionReversal(outcome)
      );
      const onlyRefunds = allRefunds.filter(outcome => 
        (outcome.conceptType || outcome.type || '').includes('refund')
      );
      const onlyCommissionReversals = allRefunds.filter(outcome => 
        (outcome.conceptType || outcome.type) === 'commission-reversal'
      );
      
      const totalRefunded = onlyRefunds.reduce((sum, refund) => sum + refund.amount, 0);
      const totalCommissionReversed = onlyCommissionReversals.reduce((sum, reversal) => sum + reversal.amount, 0);
      const originalAmount = income.amount || income.totalAmount || 0;
      const isFullyRefunded = totalRefunded >= originalAmount;

      // Crear o actualizar refundMetadata con separación clara entre refunds y commission reversals
      const refundMetadata = {
        isRefunded: isFullyRefunded,
        totalRefunded: totalRefunded,
        refundCount: onlyRefunds.length,
        originalAmount: originalAmount,
        
        // 📊 Nueva sección: Commission Reversals
        totalCommissionReversed: totalCommissionReversed,
        commissionReversalCount: onlyCommissionReversals.length,
        
        // 📋 Historial completo (refunds + commission reversals)
        refundHistory: onlyRefunds.map(refund => ({
          refundId: refund.id,
          amount: refund.amount,
          type: refund.conceptType,
          category: 'refund' as const,
          reason: refund.description,
          date: refund.createdAt,
          code: refund.code
        })),
        
        commissionReversalHistory: onlyCommissionReversals.map(reversal => ({
          reversalId: reversal.id,
          amount: reversal.amount,
          type: reversal.conceptType,
          category: 'commission-reversal' as const,
          reason: reversal.description,
          date: reversal.createdAt,
          code: reversal.code
        })),
        
        lastRefundAt: new Date(),
        lastRefundId: refundId
      };

      // Actualizar income con metadata
      income.refundMetadata = refundMetadata;
      incomeUpdated = true;

      // 🔄 Procesar reversión de comisión si aplica (solo para payment-refund)
      if (createRefundDto.type === 'payment-refund' && 
          income.commissionPaid === true && 
          income.professionalCommission && 
          income.professionalCommission > 0) {
        try {
          // Crear outcome para revertir la comisión pagada (proporcional al refund)
          const commissionReversalOutcome = await this.createCommissionReversalOutcome(income, createRefundDto.amount);
          
          console.log('[RefundService] Commission reversal outcome created:', {
            commissionReversalId: commissionReversalOutcome.id,
            amount: commissionReversalOutcome.amount,
            originalCommission: income.professionalCommission,
            refundAmount: createRefundDto.amount,
            professionalId: income.professionalId
          });

          // Si es reembolso total, marcar comisión como no pagada
          if (isFullyRefunded) {
            income.commissionPaid = false;
            income.commissionPaymentId = null;
            console.log('[RefundService] Commission marked as unpaid due to full refund');
          }
        } catch (error) {
          console.error(`[RefundService] Error al revertir comisión para income ${income.id}:`, error);
          // No fallar el refund por error en la reversión de comisión
        }
      } else if (createRefundDto.type === 'payment-refund' && 
                 income.professionalCommission && 
                 income.professionalCommission > 0 && 
                 !income.commissionPaid) {
        // Comisión NO pagada aún - marcar que no debe pagarse si hay refund
        income.commissionPaid = false;
        income.commissionPaymentId = null;
        console.log('[RefundService] Commission marked as unpaid to prevent future payment');
      }

      // Actualizar el income si hubo cambios (UNA SOLA VEZ)
      if (incomeUpdated) {
        await this.incomeService.updateIncome('refund-service', income);

        console.log('[RefundService] Income updated with refund metadata and event emitted:', {
          incomeId: income.id,
          totalRefunded: totalRefunded,
          totalCommissionReversed: totalCommissionReversed,
          isFullyRefunded: isFullyRefunded,
          refundCount: onlyRefunds.length,
          commissionReversalCount: onlyCommissionReversals.length,
          eventEmitted: true,
          commissionUpdated: createRefundDto.type === 'payment-refund'
        });
      }

    } catch (error) {
      console.error('[RefundService] Error updating income with refund metadata:', error);
      // No fallar el refund por error en la metadata
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
    reversalOutcome.description = `Reversión automática de comisión (${((refundProportion * 100).toFixed(1))}% de ${commissionAmount}) - Refund ${refundAmount} de ${income.amount}`;
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
}