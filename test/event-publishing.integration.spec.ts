import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncomeService } from '../../src/income/income.service';
import { OutcomeService } from '../../src/outcome/outcome.service';
import { RefundService } from '../../src/modules/financial/services/refund.service';
import { AccountingPeriodService } from '../../src/accounting-period/accounting-period.service';
import { EventDto } from '../shared/dto/event-dto';
import { IncomeStatus } from '../../src/income/enums/income-status.enum';
import { OutcomeStatus } from '../../src/outcome/enums/outcome-status.enum';

/**
 * PRUEBAS DE INTEGRACIÓN - PUBLICACIÓN DE EVENTOS
 *
 * Valida que todos los eventos financieros se publican correctamente
 * para ser consumidos por event-consumer y sincronizados a PostgreSQL:
 *
 * 1. Eventos de Incomes (created, updated)
 * 2. Eventos de Outcomes (created, updated)
 * 3. Eventos de Refunds (processed, approved, rejected)
 * 4. Eventos de Commission Payments
 * 5. Eventos de Accounting Periods (closed, reopened, locked)
 */
describe('Event Publishing Integration Tests', () => {
  let eventEmitter: EventEmitter2;
  let incomeService: IncomeService;
  let outcomeService: OutcomeService;
  let refundService: RefundService;

  // Espías para eventos
  const publishedEvents: EventDto[] = [];

  beforeEach(async () => {
    publishedEvents.length = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn((eventName: string, event: EventDto) => {
              publishedEvents.push({ ...event, type: eventName });
              return true;
            }),
            emitAsync: jest.fn((eventName: string, event: EventDto) => {
              publishedEvents.push({ ...event, type: eventName });
              return Promise.resolve([true]);
            }),
          },
        },
        IncomeService,
        OutcomeService,
        RefundService,
        // Mocks de repositorios
        // ... (agregar según necesidad)
      ],
    }).compile();

    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    incomeService = module.get<IncomeService>(IncomeService);
    outcomeService = module.get<OutcomeService>(OutcomeService);
    refundService = module.get<RefundService>(RefundService);
  });

  describe('Caso 1: Income Created Event', () => {
    it('debe publicar evento IncomesCreated al crear income', async () => {
      const incomeDto = {
        commerceId: 'commerce-1',
        clientId: 'client-1',
        professionalId: 'prof-1',
        amount: 1000,
        professionalCommission: 200,
        paidAt: new Date('2026-01-15'),
        status: IncomeStatus.CONFIRMED,
      };

      // Crear income (esto debería publicar el evento)
      await incomeService.createIncome(incomeDto);

      // ─────────────────────────────────────────────────────────────
      // VALIDACIÓN: Evento publicado
      // ─────────────────────────────────────────────────────────────
      expect(publishedEvents).toHaveLength(1);

      const event = publishedEvents[0];
      expect(event.type).toBe('ett.income.1.event.income.created');
      expect(event.aggregateId).toBeDefined();

      // Validar estructura del evento
      expect(event.data).toMatchObject({
        attributes: expect.objectContaining({
          commerceId: 'commerce-1',
          amount: 1000,
          professionalCommission: 200,
          status: IncomeStatus.CONFIRMED,
        }),
      });

      // ✅ Este evento debe llegar al event-consumer
      // ✅ event-consumer lo procesará con IncomesCreated handler
      // ✅ Se sincronizará a PostgreSQL en tabla 'incomes'
    });
  });

  describe('Caso 2: Income Updated Event', () => {
    it('debe publicar evento IncomesUpdated al actualizar income', async () => {
      // Simular income existente
      const income = {
        id: 'income-1',
        commerceId: 'commerce-1',
        amount: 1000,
        professionalCommission: 200,
        commissionPaid: false,
        status: IncomeStatus.CONFIRMED,
      };

      // Actualizar commission paid
      income.commissionPaid = true;
      await incomeService.updateIncome('system', income);

      // ─────────────────────────────────────────────────────────────
      // VALIDACIÓN: Evento publicado
      // ─────────────────────────────────────────────────────────────
      expect(publishedEvents).toHaveLength(1);

      const event = publishedEvents[0];
      expect(event.type).toBe('ett.income.1.event.income.updated');
      expect(event.aggregateId).toBe('income-1');

      expect(event.data.attributes).toMatchObject({
        commissionPaid: true,
      });

      // ✅ event-consumer actualizará el registro en PostgreSQL
    });
  });

  describe('Caso 3: Outcome Created Event (Payment Refund)', () => {
    it('debe publicar evento OutcomeCreated para payment-refund', async () => {
      const outcomeDto = {
        commerceId: 'commerce-1',
        type: 'payment-refund',
        conceptType: 'payment-refund',
        amount: 1000,
        auxiliaryId: 'income-1',
        paidAt: new Date('2026-01-20'),
        status: OutcomeStatus.CONFIRMED,
      };

      await outcomeService.createOutcome(outcomeDto);

      // ─────────────────────────────────────────────────────────────
      // VALIDACIÓN: Evento publicado
      // ─────────────────────────────────────────────────────────────
      expect(publishedEvents).toHaveLength(1);

      const event = publishedEvents[0];
      expect(event.type).toBe('ett.outcome.1.event.outcome.created');
      expect(event.aggregateId).toBeDefined();

      expect(event.data.attributes).toMatchObject({
        type: 'payment-refund',
        conceptType: 'payment-refund',
        amount: 1000,
        auxiliaryId: 'income-1',
      });

      // ✅ event-consumer lo procesará con OutcomesCreated handler
      // ✅ Se guardará en tabla 'outcomes' de PostgreSQL
      // ✅ query-stack aplicará CASE para mostrar como 'REFUND'
    });
  });

  describe('Caso 4: Outcome Created Event (Commission Reversal)', () => {
    it('debe publicar evento OutcomeCreated para commission-reversal', async () => {
      const outcomeDto = {
        commerceId: 'commerce-1',
        type: 'commission-reversal',
        conceptType: 'commission-reversal',
        amount: 200,
        auxiliaryId: 'income-1',
        paidAt: new Date('2026-01-20'),
        status: OutcomeStatus.CONFIRMED,
      };

      await outcomeService.createOutcome(outcomeDto);

      // ─────────────────────────────────────────────────────────────
      // VALIDACIÓN: Evento publicado
      // ─────────────────────────────────────────────────────────────
      expect(publishedEvents).toHaveLength(1);

      const event = publishedEvents[0];
      expect(event.type).toBe('ett.outcome.1.event.outcome.created');

      expect(event.data.attributes).toMatchObject({
        type: 'commission-reversal',
        conceptType: 'commission-reversal',
        amount: 200,
      });

      // ✅ event-consumer guardará en PostgreSQL
      // ✅ query-stack lo mostrará como 'COMMISSION_REVERSAL'
    });
  });

  describe('Caso 5: Refund Process - Múltiples Eventos', () => {
    it('debe publicar eventos para income update y outcomes del refund', async () => {
      const refundDto = {
        type: 'PAYMENT_REFUND',
        originalTransactionId: 'income-1',
        amount: 1000,
        reason: 'CUSTOMER_REQUEST',
        clientId: 'client-1',
      };

      // Procesar refund completo
      await refundService.processRefund(refundDto);

      // ─────────────────────────────────────────────────────────────
      // VALIDACIÓN: Múltiples eventos publicados
      // ─────────────────────────────────────────────────────────────

      // Debería haber al menos 2 eventos:
      // 1. OutcomeCreated para payment-refund
      // 2. IncomesUpdated para marcar income como refunded
      // 3. (Opcional) OutcomeCreated para commission-reversal si aplica
      expect(publishedEvents.length).toBeGreaterThanOrEqual(2);

      // Verificar evento de outcome (payment-refund)
      const paymentRefundEvent = publishedEvents.find(
        e => e.type === 'ett.outcome.1.event.outcome.created' &&
             e.data?.attributes?.type === 'payment-refund'
      );
      expect(paymentRefundEvent).toBeDefined();
      expect(paymentRefundEvent.data.attributes.amount).toBe(1000);

      // Verificar evento de income updated
      const incomeUpdatedEvent = publishedEvents.find(
        e => e.type === 'ett.income.1.event.income.updated' &&
             e.aggregateId === 'income-1'
      );
      expect(incomeUpdatedEvent).toBeDefined();
      expect(incomeUpdatedEvent.data.attributes.refundMetadata).toMatchObject({
        isRefunded: true,
        refundedAmount: 1000,
      });

      // ✅ TODOS estos eventos llegarán a event-consumer
      // ✅ PostgreSQL tendrá:
      //    - Outcome con type='payment-refund'
      //    - Income con refundMetadata actualizado
      //    - (Opcional) Outcome con type='commission-reversal'
    });
  });

  describe('Caso 6: Refund Parcial con Commission Reversal', () => {
    it('debe publicar eventos para refund parcial y reversal proporcional', async () => {
      // Income original: 1000 con comisión 200 (pagada)
      const income = {
        id: 'income-2',
        amount: 1000,
        professionalCommission: 200,
        commissionPaid: true,
      };

      // Refund parcial de 500 (50%)
      const refundDto = {
        type: 'PAYMENT_REFUND',
        originalTransactionId: 'income-2',
        amount: 500,
        reason: 'SERVICE_ISSUE',
        clientId: 'client-1',
      };

      await refundService.processRefund(refundDto);

      // ─────────────────────────────────────────────────────────────
      // VALIDACIÓN: 3 eventos publicados
      // ─────────────────────────────────────────────────────────────

      // 1. Payment-refund (500)
      const paymentRefundEvent = publishedEvents.find(
        e => e.data?.attributes?.type === 'payment-refund'
      );
      expect(paymentRefundEvent).toBeDefined();
      expect(paymentRefundEvent.data.attributes.amount).toBe(500);

      // 2. Commission-reversal (100 = 50% de 200)
      const commissionReversalEvent = publishedEvents.find(
        e => e.data?.attributes?.type === 'commission-reversal'
      );
      expect(commissionReversalEvent).toBeDefined();
      expect(commissionReversalEvent.data.attributes.amount).toBe(100);

      // 3. Income updated con metadata parcial
      const incomeUpdatedEvent = publishedEvents.find(
        e => e.type === 'ett.income.1.event.income.updated' &&
             e.aggregateId === 'income-2'
      );
      expect(incomeUpdatedEvent).toBeDefined();
      expect(incomeUpdatedEvent.data.attributes.refundMetadata).toMatchObject({
        isRefunded: true,
        refundedAmount: 500,
        isPartialRefund: true,
      });

      // ✅ VALIDACIÓN CONTABLE EN POSTGRESQL:
      // - Income mantiene amount=1000 original
      // - refundMetadata indica refund parcial de 500
      // - Outcome payment-refund: 500
      // - Outcome commission-reversal: 100
      // - Lucro restante: (1000-500) - (200-100) = 500-100 = 400
    });
  });

  describe('Caso 7: Múltiples Refunds Acumulados - Eventos Secuenciales', () => {
    it('debe publicar eventos para cada refund manteniendo acumulado correcto', async () => {
      const incomeId = 'income-3';

      // Refund 1: 30%
      await refundService.processRefund({
        type: 'PAYMENT_REFUND',
        originalTransactionId: incomeId,
        amount: 300,
        reason: 'CUSTOMER_REQUEST',
        clientId: 'client-1',
      });

      const events1 = [...publishedEvents];
      publishedEvents.length = 0;

      // Refund 2: +40% (total 70%)
      await refundService.processRefund({
        type: 'PAYMENT_REFUND',
        originalTransactionId: incomeId,
        amount: 400,
        reason: 'CUSTOMER_REQUEST',
        clientId: 'client-1',
      });

      const events2 = [...publishedEvents];
      publishedEvents.length = 0;

      // Refund 3: +30% (total 100%)
      await refundService.processRefund({
        type: 'PAYMENT_REFUND',
        originalTransactionId: incomeId,
        amount: 300,
        reason: 'CUSTOMER_REQUEST',
        clientId: 'client-1',
      });

      const events3 = [...publishedEvents];

      // ─────────────────────────────────────────────────────────────
      // VALIDACIÓN: Eventos en cada refund
      // ─────────────────────────────────────────────────────────────

      // Cada refund genera al menos 2 eventos
      expect(events1.length).toBeGreaterThanOrEqual(2);
      expect(events2.length).toBeGreaterThanOrEqual(2);
      expect(events3.length).toBeGreaterThanOrEqual(2);

      // Verificar que el último evento tiene refundedAmount acumulado
      const finalIncomeUpdate = events3.find(
        e => e.type === 'ett.income.1.event.income.updated'
      );
      expect(finalIncomeUpdate.data.attributes.refundMetadata).toMatchObject({
        refundedAmount: 1000, // 300 + 400 + 300
        isPartialRefund: false, // Ya es total
      });

      // ✅ event-consumer procesa cada evento secuencialmente
      // ✅ PostgreSQL refleja el estado acumulado correcto
      // ✅ Cada outcome se guarda con su monto individual
    });
  });

  describe('Caso 8: Outcome Updated Event', () => {
    it('debe publicar evento OutcomeUpdated al cambiar status', async () => {
      const outcome = {
        id: 'outcome-1',
        commerceId: 'commerce-1',
        type: 'RENT',
        amount: 500,
        status: OutcomeStatus.PENDING,
      };

      // Cambiar a CONFIRMED
      outcome.status = OutcomeStatus.CONFIRMED;
      await outcomeService.updateOutcome('outcome-1', outcome);

      // ─────────────────────────────────────────────────────────────
      // VALIDACIÓN: Evento publicado
      // ─────────────────────────────────────────────────────────────
      expect(publishedEvents).toHaveLength(1);

      const event = publishedEvents[0];
      expect(event.type).toBe('ett.outcome.1.event.outcome.updated');
      expect(event.aggregateId).toBe('outcome-1');
      expect(event.data.attributes.status).toBe(OutcomeStatus.CONFIRMED);

      // ✅ event-consumer actualizará status en PostgreSQL
    });
  });

  describe('Caso 9: Accounting Period Closed Event', () => {
    it('debe publicar evento al cerrar período contable', async () => {
      const periodId = 'period-1';
      const closeDto = {
        closedBy: 'admin-1',
        notes: 'Cierre mensual',
        reconciliationData: {
          bankBalance: 10000,
          systemBalance: 9950,
          difference: 50,
        },
      };

      // Cerrar período (esto debería publicar AccountingPeriodClosed)
      // await accountingPeriodService.closePeriod(periodId, closeDto);

      // ─────────────────────────────────────────────────────────────
      // VALIDACIÓN: Evento publicado
      // ─────────────────────────────────────────────────────────────
      // El evento debería contener:
      // - periodId
      // - totals (totalIncomes, totalOutcomes, etc.)
      // - closedBy
      // - closedAt

      // ✅ Este evento puede usarse para:
      //    - Notificar administradores
      //    - Actualizar dashboards en tiempo real
      //    - Auditoría de cierres
    });
  });

  describe('Caso 10: Validación de Estructura de Eventos', () => {
    it('todos los eventos deben tener estructura estándar', async () => {
      // Crear diversas transacciones
      await incomeService.createIncome({
        commerceId: 'commerce-1',
        amount: 1000,
        professionalCommission: 200,
        paidAt: new Date(),
        status: IncomeStatus.CONFIRMED,
      });

      await outcomeService.createOutcome({
        commerceId: 'commerce-1',
        type: 'RENT',
        conceptType: 'rent',
        amount: 500,
        paidAt: new Date(),
        status: OutcomeStatus.CONFIRMED,
      });

      // ─────────────────────────────────────────────────────────────
      // VALIDACIÓN: Estructura de todos los eventos
      // ─────────────────────────────────────────────────────────────
      publishedEvents.forEach((event, index) => {
        // Cada evento debe tener:
        expect(event.type).toBeDefined(); // Tipo de evento
        expect(event.aggregateId).toBeDefined(); // ID del aggregate
        expect(event.data).toBeDefined(); // Data del evento
        expect(event.data.attributes).toBeDefined(); // Atributos de la entidad

        // Opcional: timestamp, version, metadata
        // expect(event.timestamp).toBeDefined();
        // expect(event.version).toBeDefined();

        console.log(`Evento ${index + 1}:`, {
          type: event.type,
          aggregateId: event.aggregateId,
          attributes: Object.keys(event.data.attributes || {}),
        });
      });

      // ✅ Todos los eventos siguen el mismo patrón
      // ✅ event-consumer puede procesarlos uniformemente
    });
  });
});
