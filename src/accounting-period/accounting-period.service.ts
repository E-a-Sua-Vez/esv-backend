import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { AccountingPeriod, PeriodTotals } from './model/accounting-period.entity';
import { AccountingPeriodStatus } from './model/accounting-period-status.enum';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';
import { ClosePeriodDto } from './dto/close-period.dto';
import { ReopenPeriodDto } from './dto/reopen-period.dto';
import { LockPeriodDto } from './dto/lock-period.dto';
import AccountingPeriodCreated from './events/AccountingPeriodCreated';
import AccountingPeriodClosed from './events/AccountingPeriodClosed';
import AccountingPeriodReopened from './events/AccountingPeriodReopened';
import AccountingPeriodLocked from './events/AccountingPeriodLocked';
import { IncomeService } from '../income/income.service';
import { OutcomeService } from '../outcome/outcome.service';
import { IncomeStatus } from '../income/model/income-status.enum';
import { OutcomeStatus } from '../outcome/model/outcome-status.enum';

@Injectable()
export class AccountingPeriodService {
  private readonly logger = new Logger(AccountingPeriodService.name);

  constructor(
    @InjectRepository(AccountingPeriod)
    private periodRepository = getRepository(AccountingPeriod),
    private incomeService: IncomeService,
    private outcomeService: OutcomeService,
  ) {}

  /**
   * Obtiene todos los períodos de un commerce con filtros opcionales
   */
  public async getPeriodsByCommerce(
    commerceId: string,
    searchText?: string,
    status?: string,
    year?: string,
    startDate?: string,
    endDate?: string,
    limit?: number,
    offset?: number,
  ): Promise<AccountingPeriod[]> {
    let query = this.periodRepository.whereEqualTo('commerceId', commerceId);

    // Filtro por status
    if (status) {
      query = query.whereEqualTo('status', status);
    }

    // Ordenar por fecha de inicio descendente
    query = query.orderByDescending('startDate');

    // Obtener todos los períodos
    let periods = await query.find();

    // Aplicar filtros de búsqueda en memoria (Firestore no soporta LIKE)
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      periods = periods.filter(
        (p) =>
          p.name?.toLowerCase().includes(searchLower) ||
          p.notes?.toLowerCase().includes(searchLower),
      );
    }

    // Filtro por año
    if (year) {
      const yearNum = parseInt(year);
      periods = periods.filter((p) => {
        const startYear = new Date(p.startDate).getFullYear();
        const endYear = new Date(p.endDate).getFullYear();
        return startYear === yearNum || endYear === yearNum;
      });
    }

    // Filtro por rango de fechas
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      periods = periods.filter((p) => {
        const periodStart = new Date(p.startDate);
        const periodEnd = new Date(p.endDate);
        // Período se superpone con el rango de búsqueda
        return (
          (periodStart >= start && periodStart <= end) ||
          (periodEnd >= start && periodEnd <= end) ||
          (periodStart <= start && periodEnd >= end)
        );
      });
    }

    // Aplicar paginación si se especifica
    if (limit !== undefined && offset !== undefined) {
      const start = offset;
      const end = offset + limit;
      periods = periods.slice(start, end);
    }

    return periods;
  }

  /**
   * Obtiene un período por ID
   */
  public async getPeriodById(id: string): Promise<AccountingPeriod> {
    const period = await this.periodRepository.findById(id);
    if (!period) {
      throw new HttpException('Período contable no encontrado', HttpStatus.NOT_FOUND);
    }
    return period;
  }

  /**
   * Obtiene el período actualmente abierto (OPEN) para un commerce
   */
  public async getCurrentOpenPeriod(commerceId: string): Promise<AccountingPeriod | null> {
    const periods = await this.periodRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('status', AccountingPeriodStatus.OPEN)
      .find();

    return periods.length > 0 ? periods[0] : null;
  }

  /**
   * Crea un nuevo período contable
   */
  public async createPeriod(dto: CreateAccountingPeriodDto): Promise<AccountingPeriod> {
    this.logger.log(`Creating accounting period: ${dto.name}`);

    // Validar que no haya solapamiento con otros períodos
    await this.validatePeriodDates(dto.commerceId, new Date(dto.startDate), new Date(dto.endDate));

    // Validar que no haya otro período abierto
    const currentOpen = await this.getCurrentOpenPeriod(dto.commerceId);
    if (currentOpen) {
      throw new HttpException(
        `Ya existe un período abierto: ${currentOpen.name}. Cierra el período actual antes de crear uno nuevo.`,
        HttpStatus.BAD_REQUEST
      );
    }

    const period = new AccountingPeriod();
    period.name = dto.name;
    period.startDate = new Date(dto.startDate);
    period.endDate = new Date(dto.endDate);
    period.status = AccountingPeriodStatus.OPEN;
    period.commerceId = dto.commerceId;
    period.createdBy = dto.createdBy;
    period.createdAt = new Date();
    period.notes = dto.notes;

    // Inicializar totales en 0
    period.totals = {
      totalIncomes: 0,
      totalOutcomes: 0,
      totalCommissions: 0,
      totalRefunds: 0,
      totalCommissionReversals: 0,
      netAmount: 0,
      incomesCount: 0,
      outcomesCount: 0,
    };

    const savedPeriod = await this.periodRepository.create(period);

    // Emitir evento
    const event = new AccountingPeriodCreated(new Date(), {
      periodId: savedPeriod.id,
      name: savedPeriod.name,
      startDate: savedPeriod.startDate,
      endDate: savedPeriod.endDate,
      commerceId: savedPeriod.commerceId,
      createdBy: savedPeriod.createdBy,
    });
    await publish(event);

    this.logger.log(`Accounting period created: ${savedPeriod.id}`);
    return savedPeriod;
  }

  /**
   * Cierra un período contable
   */
  public async closePeriod(id: string, dto: ClosePeriodDto): Promise<AccountingPeriod> {
    this.logger.log(`Closing accounting period: ${id}`);

    const period = await this.getPeriodById(id);

    if (period.status !== AccountingPeriodStatus.OPEN) {
      throw new HttpException(
        'Solo se pueden cerrar períodos con estado OPEN',
        HttpStatus.BAD_REQUEST
      );
    }

    // Validar que no haya transacciones pendientes
    await this.validateNoPendingTransactions(period);

    // Calcular totales del período
    const totals = await this.calculatePeriodTotals(period);

    // Marcar todas las transacciones del período como cerradas
    await this.markTransactionsAsClosed(period);

    // Actualizar el período
    period.status = AccountingPeriodStatus.CLOSED;
    period.closedBy = dto.closedBy;
    period.closedAt = new Date();
    period.totals = totals;
    period.reconciliationData = dto.reconciliationData;
    if (dto.notes) {
      period.notes = dto.notes;
    }

    const updatedPeriod = await this.periodRepository.update(period);

    // Emitir evento
    const event = new AccountingPeriodClosed(new Date(), {
      periodId: updatedPeriod.id,
      name: updatedPeriod.name,
      startDate: updatedPeriod.startDate,
      endDate: updatedPeriod.endDate,
      totals: updatedPeriod.totals,
      closedBy: updatedPeriod.closedBy,
      commerceId: updatedPeriod.commerceId,
    });
    await publish(event);

    this.logger.log(`Accounting period closed: ${updatedPeriod.id}`);
    return updatedPeriod;
  }

  /**
   * Reabre un período cerrado
   */
  public async reopenPeriod(id: string, dto: ReopenPeriodDto): Promise<AccountingPeriod> {
    this.logger.log(`Reopening accounting period: ${id}`);

    const period = await this.getPeriodById(id);

    if (period.status === AccountingPeriodStatus.LOCKED) {
      throw new HttpException(
        'No se puede reabrir un período bloqueado (LOCKED)',
        HttpStatus.BAD_REQUEST
      );
    }

    if (period.status === AccountingPeriodStatus.OPEN) {
      throw new HttpException(
        'El período ya está abierto',
        HttpStatus.BAD_REQUEST
      );
    }

    // Verificar que no haya un período posterior cerrado
    await this.validateNoClosedPeriodsAfter(period);

    // Desmarcar transacciones como cerradas
    await this.unmarkTransactionsAsClosed(period);

    period.status = AccountingPeriodStatus.OPEN;
    period.reopenedBy = dto.reopenedBy;
    period.reopenedAt = new Date();
    if (!period.notes) {
      period.notes = '';
    }
    period.notes += `\n[Reabierto el ${new Date().toISOString()}] Razón: ${dto.reason}`;

    const updatedPeriod = await this.periodRepository.update(period);

    // Emitir evento
    const event = new AccountingPeriodReopened(new Date(), {
      periodId: updatedPeriod.id,
      name: updatedPeriod.name,
      reopenedBy: updatedPeriod.reopenedBy,
      reason: dto.reason,
      commerceId: updatedPeriod.commerceId,
    });
    await publish(event);

    this.logger.log(`Accounting period reopened: ${updatedPeriod.id}`);
    return updatedPeriod;
  }

  /**
   * Bloquea un período (no se puede reabrir)
   */
  public async lockPeriod(id: string, dto: LockPeriodDto): Promise<AccountingPeriod> {
    this.logger.log(`Locking accounting period: ${id}`);

    const period = await this.getPeriodById(id);

    if (period.status !== AccountingPeriodStatus.CLOSED) {
      throw new HttpException(
        'Solo se pueden bloquear períodos cerrados',
        HttpStatus.BAD_REQUEST
      );
    }

    period.status = AccountingPeriodStatus.LOCKED;
    period.lockedBy = dto.lockedBy;
    period.lockedAt = new Date();
    if (!period.notes) {
      period.notes = '';
    }
    period.notes += `\n[Bloqueado el ${new Date().toISOString()}] Razón: ${dto.reason}`;

    const updatedPeriod = await this.periodRepository.update(period);

    // Emitir evento
    const event = new AccountingPeriodLocked(new Date(), {
      periodId: updatedPeriod.id,
      name: updatedPeriod.name,
      lockedBy: updatedPeriod.lockedBy,
      reason: dto.reason,
      commerceId: updatedPeriod.commerceId,
    });
    await publish(event);

    this.logger.log(`Accounting period locked: ${updatedPeriod.id}`);
    return updatedPeriod;
  }

  /**
   * Obtiene el resumen de un período (totales actuales)
   */
  public async getPeriodSummary(id: string): Promise<PeriodTotals> {
    const period = await this.getPeriodById(id);

    if (period.status === AccountingPeriodStatus.OPEN) {
      // Si está abierto, calcular totales en tiempo real
      return await this.calculatePeriodTotals(period);
    } else {
      // Si está cerrado o bloqueado, devolver totales guardados
      return period.totals;
    }
  }

  /**
   * Obtiene todas las transacciones de un período
   */
  public async getPeriodTransactions(id: string): Promise<{
    incomes: any[];
    outcomes: any[];
  }> {
    const period = await this.getPeriodById(id);

    const allIncomes = await this.incomeService.getIncomeByCommerce(period.commerceId);
    const allOutcomes = await this.outcomeService.getOutcomeByCommerce(period.commerceId);

    this.logger.log(`📋 Period transactions for ${id}: Found ${allIncomes.length} total incomes, ${allOutcomes.length} total outcomes`);

    // Filtrar transacciones del período
    const periodIncomes = allIncomes
      .filter(income =>
        income.paidAt >= period.startDate &&
        income.paidAt <= period.endDate &&
        income.status === IncomeStatus.CONFIRMED
      )
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

    // Filtrar outcomes - incluir refunds/commission reversals con lógica especial de fechas
    const periodOutcomes = allOutcomes.filter(outcome => {
      const conceptType = outcome.conceptType || outcome.type || '';
      const isRefund = conceptType === 'PAYMENT_REFUND' || 
                      conceptType === 'SERVICE_REFUND' || 
                      conceptType === 'CANCELLATION_REFUND' ||
                      conceptType === 'payment-refund' || 
                      conceptType === 'service-refund' || 
                      conceptType === 'cancellation-refund';
      const isCommissionReversal = conceptType === 'COMMISSION_REVERSAL' || conceptType === 'commission-reversal';
      const isConfirmed = outcome.status === OutcomeStatus.CONFIRMED;
      
      // Para refunds/reversals con PaidAt undefined, usar createdAt como respaldo
      let inDateRange = false;
      if (outcome.paidAt) {
        inDateRange = outcome.paidAt >= period.startDate && outcome.paidAt <= period.endDate;
      } else if (isRefund || isCommissionReversal) {
        // Si es refund/reversal sin paidAt, usar createdAt como respaldo
        const dateToCheck = outcome.createdAt;
        if (dateToCheck) {
          inDateRange = dateToCheck >= period.startDate && dateToCheck <= period.endDate;
        } else {
          // Si no hay fecha válida, incluir el refund (asumimos que pertenece al período)
          inDateRange = true;
        }
      } else {
        inDateRange = outcome.paidAt >= period.startDate && outcome.paidAt <= period.endDate;
      }

      // Incluir si está confirmado O si es un refund/reversal (que siempre deben contarse)
      return inDateRange && (isConfirmed || isRefund || isCommissionReversal);
    }).sort((a, b) => {
      const dateA = a.paidAt || a.createdAt;
      const dateB = b.paidAt || b.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    this.logger.log(`📊 Filtered results: ${periodIncomes.length} incomes, ${periodOutcomes.length} outcomes`);
    this.logger.log('📝 Outcomes details:', periodOutcomes.map(o => ({
      id: o.id,
      conceptType: o.conceptType,
      type: o.type,
      amount: o.amount,
      paidAt: o.paidAt,
      createdAt: o.createdAt,
      status: o.status
    })));

    return {
      incomes: periodIncomes,
      outcomes: periodOutcomes,
    };
  }

  /**
   * Verifica si una transacción pertenece a un período cerrado
   */
  public async isTransactionInClosedPeriod(
    commerceId: string,
    transactionDate: Date
  ): Promise<boolean> {
    const periods = await this.periodRepository
      .whereEqualTo('commerceId', commerceId)
      .whereIn('status', [AccountingPeriodStatus.CLOSED, AccountingPeriodStatus.LOCKED])
      .find();

    for (const period of periods) {
      if (transactionDate >= period.startDate && transactionDate <= period.endDate) {
        return true;
      }
    }

    return false;
  }

  /**
   * Obtiene el período al que pertenece una transacción
   */
  public async getPeriodForTransaction(
    commerceId: string,
    transactionDate: Date
  ): Promise<AccountingPeriod | null> {
    const periods = await this.periodRepository
      .whereEqualTo('commerceId', commerceId)
      .find();

    for (const period of periods) {
      if (transactionDate >= period.startDate && transactionDate <= period.endDate) {
        return period;
      }
    }

    // Si no hay período, devolver el período abierto actual o null
    return await this.getCurrentOpenPeriod(commerceId);
  }

  // ================= MÉTODOS PRIVADOS =================

  private async validatePeriodDates(
    commerceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    if (startDate >= endDate) {
      throw new HttpException(
        'La fecha de inicio debe ser menor que la fecha de fin',
        HttpStatus.BAD_REQUEST
      );
    }

    // Verificar solapamiento con otros períodos
    const existingPeriods = await this.periodRepository
      .whereEqualTo('commerceId', commerceId)
      .find();

    for (const period of existingPeriods) {
      const overlapStart = startDate >= period.startDate && startDate <= period.endDate;
      const overlapEnd = endDate >= period.startDate && endDate <= period.endDate;
      const encompass = startDate <= period.startDate && endDate >= period.endDate;

      if (overlapStart || overlapEnd || encompass) {
        throw new HttpException(
          `El período se solapa con: ${period.name}`,
          HttpStatus.BAD_REQUEST
        );
      }
    }
  }

  private async validateNoClosedPeriodsAfter(period: AccountingPeriod): Promise<void> {
    const periods = await this.periodRepository
      .whereEqualTo('commerceId', period.commerceId)
      .whereIn('status', [AccountingPeriodStatus.CLOSED, AccountingPeriodStatus.LOCKED])
      .find();

    const hasClosedAfter = periods.some(p => p.startDate > period.endDate);

    if (hasClosedAfter) {
      throw new HttpException(
        'No se puede reabrir un período si hay períodos posteriores cerrados',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async validateNoPendingTransactions(period: AccountingPeriod): Promise<void> {
    // Buscar incomes pendientes en el período
    const allIncomes = await this.incomeService.getIncomeByCommerce(period.commerceId);
    const pendingIncomes = allIncomes.filter(income =>
      income.status === IncomeStatus.PENDING &&
      income.createdAt >= period.startDate &&
      income.createdAt <= period.endDate
    );

    if (pendingIncomes.length > 0) {
      throw new HttpException(
        `Hay ${pendingIncomes.length} ingresos pendientes en este período. Confírmalos o cancélalos antes de cerrar.`,
        HttpStatus.BAD_REQUEST
      );
    }

    // Buscar outcomes pendientes en el período
    const allOutcomes = await this.outcomeService.getOutcomeByCommerce(period.commerceId);
    const pendingOutcomes = allOutcomes.filter(outcome =>
      outcome.status === OutcomeStatus.PENDING &&
      outcome.createdAt >= period.startDate &&
      outcome.createdAt <= period.endDate
    );

    if (pendingOutcomes.length > 0) {
      throw new HttpException(
        `Hay ${pendingOutcomes.length} egresos pendientes en este período. Confírmalos o cancélalos antes de cerrar.`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async calculatePeriodTotals(period: AccountingPeriod): Promise<PeriodTotals> {
    const allIncomes = await this.incomeService.getIncomeByCommerce(period.commerceId);
    const allOutcomes = await this.outcomeService.getOutcomeByCommerce(period.commerceId);

    console.log('🔍 DEBUG: Accounting Period Calculation');
    console.log('Period:', period.id, 'Commerce:', period.commerceId);
    console.log('Date Range:', period.startDate, 'to', period.endDate);
    console.log('Period Status:', period.status);
    console.log('Total incomes in DB:', allIncomes.length);
    console.log('Total outcomes in DB:', allOutcomes.length);
    
    // COMPARACIÓN CON QUERY STACK - mostrar qué deberíamos tener
    console.log('🎯 EXPECTED FROM QUERY STACK:');
    console.log('- Should have 7 incomes totaling 3000 with 980 commission');
    console.log('- Should have 2 refunds: PAYMENT_REFUND(500) + CANCELLATION_REFUND(200) = 700');
    console.log('');

    console.log('📋 ALL INCOMES IN DB:');
    allIncomes.forEach((income, idx) => {
      const inPeriod = income.paidAt >= period.startDate && income.paidAt <= period.endDate && income.status === IncomeStatus.CONFIRMED;
      console.log(`${idx + 1}. ID: ${income.id}, Amount: ${income.amount}, Commission: ${income.professionalCommission}, PaidAt: ${income.paidAt}, Status: ${income.status}, InPeriod: ${inPeriod ? '✅' : '❌'}`);
    });

    console.log('📋 ALL OUTCOMES IN DB:');
    allOutcomes.forEach((outcome, idx) => {
      const inPeriod = outcome.paidAt >= period.startDate && outcome.paidAt <= period.endDate;
      console.log(`${idx + 1}. ID: ${outcome.id}, Amount: ${outcome.amount}, ConceptType: ${outcome.conceptType}, Type: ${outcome.type}, PaidAt: ${outcome.paidAt}, Status: ${outcome.status}, InPeriod: ${inPeriod ? '✅' : '❌'}`);
    });

    // Filtrar transacciones del período
    const periodIncomes = allIncomes.filter(income =>
      income.paidAt >= period.startDate &&
      income.paidAt <= period.endDate &&
      income.status === IncomeStatus.CONFIRMED
    );

    console.log('Filtered period incomes:', periodIncomes.length);
    console.log('Period incomes details:', periodIncomes.map(i => ({
      id: i.id,
      amount: i.amount,
      paidAt: i.paidAt,
      status: i.status,
      refundMetadata: i.refundMetadata
    })));

    // Filtrar outcomes - incluir refunds independientemente del status
    const periodOutcomes = allOutcomes.filter(outcome => {
      const conceptType = outcome.conceptType || outcome.type || '';
      const isRefund = conceptType === 'PAYMENT_REFUND' || 
                      conceptType === 'SERVICE_REFUND' || 
                      conceptType === 'CANCELLATION_REFUND' ||
                      conceptType === 'payment-refund' || 
                      conceptType === 'service-refund' || 
                      conceptType === 'cancellation-refund';
      const isCommissionReversal = conceptType === 'COMMISSION_REVERSAL' || conceptType === 'commission-reversal';
      const isConfirmed = outcome.status === OutcomeStatus.CONFIRMED;
      
      // Para refunds/reversals con PaidAt undefined, usar createdAt o considerar que están en el período
      let inDateRange = false;
      if (outcome.paidAt) {
        inDateRange = outcome.paidAt >= period.startDate && outcome.paidAt <= period.endDate;
      } else if (isRefund || isCommissionReversal) {
        // Si es refund/reversal sin paidAt, usar createdAt como respaldo o incluir automáticamente
        const dateToCheck = outcome.createdAt;
        if (dateToCheck) {
          inDateRange = dateToCheck >= period.startDate && dateToCheck <= period.endDate;
        } else {
          // Si no hay fecha válida, incluir el refund (asumimos que pertenece al período)
          console.log(`⚠️  Refund/Reversal ${outcome.id} has no paidAt or createdAt - including in period`);
          inDateRange = true;
        }
      } else {
        inDateRange = outcome.paidAt >= period.startDate && outcome.paidAt <= period.endDate;
      }

      // Incluir si está confirmado O si es un refund/reversal (que siempre deben contarse)
      return inDateRange && (isConfirmed || isRefund || isCommissionReversal);
    });

    console.log('Filtered period outcomes:', periodOutcomes.length);
    console.log('Period outcomes details:', periodOutcomes.map(o => ({
      id: o.id,
      amount: o.amount,
      paidAt: o.paidAt,
      conceptType: o.conceptType,
      type: o.type, // También mostrar el campo type
      status: o.status
    })));

    // Calcular totales
    let totalIncomes = 0;
    let totalCommissions = 0;
    let incomesCount = 0;

    periodIncomes.forEach(income => {
      // NUEVO ENFOQUE: Incluir TODOS los incomes para metodología bruta/completa
      // Los refunds se manejan por separado, no restamos de incomes
      totalIncomes += income.amount || 0;
      totalCommissions += income.professionalCommission || 0;
      incomesCount++;
      
      const refundMeta = income.refundMetadata;
      console.log(`💰 INCLUDING Income ${income.id}: Amount ${income.amount}, Commission ${income.professionalCommission}, RefundMeta: ${refundMeta ? 'HAS_REFUNDS' : 'NO_REFUNDS'}`);
    });

    let totalOutcomes = 0;
    let totalRefunds = 0;
    let totalCommissionReversals = 0;
    let outcomesCount = 0;

    periodOutcomes.forEach(outcome => {
      const conceptType = outcome.conceptType || outcome.type || '';
      const isRefund = conceptType === 'PAYMENT_REFUND' || 
                      conceptType === 'SERVICE_REFUND' || 
                      conceptType === 'CANCELLATION_REFUND' ||
                      conceptType === 'payment-refund' || 
                      conceptType === 'service-refund' || 
                      conceptType === 'cancellation-refund';
      const isCommissionReversal = conceptType === 'COMMISSION_REVERSAL' || conceptType === 'commission-reversal';

      if (isRefund) {
        console.log('💰 Found REFUND:', outcome.id, 'Type:', conceptType, 'Amount:', outcome.amount);
        totalRefunds += Math.abs(outcome.amount || 0);
      } else if (isCommissionReversal) {
        console.log('🔄 Found COMMISSION_REVERSAL:', outcome.id, 'Type:', conceptType, 'Amount:', outcome.amount);
        totalCommissionReversals += Math.abs(outcome.amount || 0);
      } else {
        console.log('📝 Found OTHER OUTCOME:', outcome.id, 'Type:', conceptType, 'Amount:', outcome.amount);
        totalOutcomes += Math.abs(outcome.amount || 0);
        outcomesCount++;
      }
    });

    const netAmount = totalIncomes - totalOutcomes - totalCommissions - totalRefunds + totalCommissionReversals;

    const result = {
      totalIncomes,
      totalOutcomes,
      totalCommissions,
      totalRefunds,
      totalCommissionReversals,
      netAmount,
      incomesCount,
      outcomesCount,
    };

    console.log('📊 Calculated totals:', result);
    console.log('');
    console.log('🔍 COMPARISON WITH EXPECTED:');
    console.log(`Incomes: ${totalIncomes} (expected 3000) - Count: ${incomesCount} (expected 7)`);
    console.log(`Commissions: ${totalCommissions} (expected 980)`);
    console.log(`Refunds: ${totalRefunds} (expected 700)`);
    console.log(`Commission Reversals: ${totalCommissionReversals} (expected 180)`);
    console.log(`Outcomes: ${totalOutcomes} (expected 180 - only non-refunds)`);
    console.log(`Net Amount: ${result.netAmount} (calculated as incomes - outcomes - commissions - refunds + reversals)`);
    console.log('🔚 DEBUG END\n');

    return result;
  }

  private async markTransactionsAsClosed(period: AccountingPeriod): Promise<void> {
    const allIncomes = await this.incomeService.getIncomeByCommerce(period.commerceId);
    const allOutcomes = await this.outcomeService.getOutcomeByCommerce(period.commerceId);

    // Marcar incomes
    const periodIncomes = allIncomes.filter(income =>
      income.paidAt >= period.startDate &&
      income.paidAt <= period.endDate
    );

    for (const income of periodIncomes) {
      income.accountingPeriodId = period.id;
      income.isClosed = true;
      income.closedAt = new Date();
      await this.incomeService.updateIncome(income.id, income);
    }

    // Marcar outcomes
    const periodOutcomes = allOutcomes.filter(outcome =>
      outcome.paidAt >= period.startDate &&
      outcome.paidAt <= period.endDate
    );

    for (const outcome of periodOutcomes) {
      outcome.accountingPeriodId = period.id;
      outcome.isClosed = true;
      outcome.closedAt = new Date();
      await this.outcomeService.updateOutcome(outcome.id, outcome);
    }
  }

  private async unmarkTransactionsAsClosed(period: AccountingPeriod): Promise<void> {
    const allIncomes = await this.incomeService.getIncomeByCommerce(period.commerceId);
    const allOutcomes = await this.outcomeService.getOutcomeByCommerce(period.commerceId);

    // Desmarcar incomes
    const periodIncomes = allIncomes.filter(income => income.accountingPeriodId === period.id);

    for (const income of periodIncomes) {
      income.isClosed = false;
      income.closedAt = undefined;
      await this.incomeService.updateIncome(income.id, income);
    }

    // Desmarcar outcomes
    const periodOutcomes = allOutcomes.filter(outcome => outcome.accountingPeriodId === period.id);

    for (const outcome of periodOutcomes) {
      outcome.isClosed = false;
      outcome.closedAt = undefined;
      await this.outcomeService.updateOutcome(outcome.id, outcome);
    }
  }
}
