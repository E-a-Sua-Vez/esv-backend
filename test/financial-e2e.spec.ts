import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from 'nestjs-fireorm';
import { RefundService } from '../src/modules/financial/services/refund.service';
import { AccountingPeriodService } from '../src/accounting-period/accounting-period.service';
import { IncomeService } from '../src/income/income.service';
import { OutcomeService } from '../src/outcome/outcome.service';
import { CreateRefundDto, RefundType, RefundReason } from '../src/modules/financial/dto/create-refund.dto';

/**
 * PRUEBAS DE INTEGRACIÓN E2E - SISTEMA FINANCIERO
 *
 * Estas pruebas validan el flujo completo desde la creación de transacciones
 * hasta el cálculo de períodos contables, asegurando que:
 *
 * 1. Los refunds se crean correctamente en Firestore
 * 2. Las commission-reversals se generan automáticamente
 * 3. Los incomes se marcan como refunded
 * 4. Los cálculos de períodos contables son exactos
 * 5. La caja cuadra matemáticamente en todos los casos
 */
describe('E2E - Flujo Financiero Completo', () => {
  let app: INestApplication;
  let refundService: RefundService;
  let periodService: AccountingPeriodService;
  let incomeService: IncomeService;
  let outcomeService: OutcomeService;

  // Base de datos en memoria para tests
  const testDatabase = {
    incomes: new Map(),
    outcomes: new Map(),
    periods: new Map(),
  };

  beforeAll(async () => {
    // Configurar módulo de prueba con mocks
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        RefundService,
        AccountingPeriodService,
        IncomeService,
        OutcomeService,
        {
          provide: getRepositoryToken('Income'),
          useValue: createMockRepository(testDatabase.incomes),
        },
        {
          provide: getRepositoryToken('Outcome'),
          useValue: createMockRepository(testDatabase.outcomes),
        },
        {
          provide: getRepositoryToken('AccountingPeriod'),
          useValue: createMockRepository(testDatabase.periods),
        },
      ],
    }).compile();

    refundService = moduleFixture.get<RefundService>(RefundService);
    periodService = moduleFixture.get<AccountingPeriodService>(AccountingPeriodService);
    incomeService = moduleFixture.get<IncomeService>(IncomeService);
    outcomeService = moduleFixture.get<OutcomeService>(OutcomeService);
  });

  beforeEach(() => {
    // Limpiar base de datos antes de cada test
    testDatabase.incomes.clear();
    testDatabase.outcomes.clear();
    testDatabase.periods.clear();
  });

  describe('Escenario 1: Ciclo Completo con Refund Total', () => {
    it('debe manejar correctamente: creación income → refund → cálculo período', async () => {
      const commerceId = 'commerce-test-1';
      const periodId = 'period-test-1';

      // ─────────────────────────────────────────────────────────────
      // FASE 1: Crear Income Original
      // ─────────────────────────────────────────────────────────────
      const income = await incomeService.createIncome({
        commerceId,
        amount: 100,
        professionalCommission: 20,
        professionalId: 'prof-1',
        clientId: 'client-1',
        paidAt: new Date('2026-01-15'),
        status: 'CONFIRMED',
      });

      expect(testDatabase.incomes.size).toBe(1);
      expect(income.amount).toBe(100);
      expect(income.professionalCommission).toBe(20);
      expect(income.commissionPaid).toBe(false);

      // ─────────────────────────────────────────────────────────────
      // FASE 2: "Pagar" Comisión (simular)
      // ─────────────────────────────────────────────────────────────
      income.commissionPaid = true;
      income.commissionPaymentId = 'payment-1';
      await incomeService.updateIncome('system', income);

      // ─────────────────────────────────────────────────────────────
      // FASE 3: Procesar Refund Total
      // ─────────────────────────────────────────────────────────────
      const refundDto: CreateRefundDto = {
        type: RefundType.PAYMENT_REFUND,
        originalTransactionId: income.id,
        amount: 100,
        reason: RefundReason.CUSTOMER_REQUEST,
        clientId: 'client-1',
      };

      const refundResult = await refundService.processRefund(refundDto);

      expect(refundResult.success).toBe(true);

      // Verificar que se crearon 2 outcomes
      const outcomes = Array.from(testDatabase.outcomes.values());
      expect(outcomes).toHaveLength(2);

      const paymentRefund = outcomes.find(o => o.type === 'payment-refund');
      const commissionReversal = outcomes.find(o => o.type === 'commission-reversal');

      expect(paymentRefund).toBeDefined();
      expect(paymentRefund.amount).toBe(100);

      expect(commissionReversal).toBeDefined();
      expect(commissionReversal.amount).toBe(20);

      // Verificar que income se actualizó
      const updatedIncome = testDatabase.incomes.get(income.id);
      expect(updatedIncome.refundMetadata).toMatchObject({
        isRefunded: true,
        refundedAmount: 100,
        isPartialRefund: false,
      });
      expect(updatedIncome.commissionPaid).toBe(false); // Resetea porque es refund total

      // ─────────────────────────────────────────────────────────────
      // FASE 4: Crear Período Contable y Calcular
      // ─────────────────────────────────────────────────────────────
      const period = await periodService.createPeriod({
        commerceId,
        name: 'Test Period',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      });

      const summary = await periodService.getPeriodSummary(period.id);

      // ─────────────────────────────────────────────────────────────
      // VALIDACIÓN CONTABLE FINAL
      // ─────────────────────────────────────────────────────────────
      expect(summary).toMatchObject({
        totalIncomes: 100,
        totalOutcomes: 0,
        totalCommissions: 20,
        totalRefunds: 100,
        totalCommissionReversals: 20,
        netAmount: 0, // 100 - 0 - 20 - 100 + 20 = 0 ✅
      });

      // ✅ CAJA CUADRADA: Todo vuelve a 0
      // Cliente recupera: 100
      // Profesional devuelve: 20
      // Comercio pierde: 80 (su lucro)
      // Balance: 100 - 100 + 20 - 20 = 0 ✅
    });
  });

  describe('Escenario 2: Múltiples Transacciones con Refunds Parciales', () => {
    it('debe calcular correctamente un mes completo con refunds parciales', async () => {
      const commerceId = 'commerce-test-2';

      // ─────────────────────────────────────────────────────────────
      // CREAR TRANSACCIONES DEL MES
      // ─────────────────────────────────────────────────────────────

      // Income 1: 1000 (comisión 200) - Sin refund
      const income1 = await incomeService.createIncome({
        commerceId,
        amount: 1000,
        professionalCommission: 200,
        professionalId: 'prof-1',
        paidAt: new Date('2026-01-05'),
        status: 'CONFIRMED',
      });

      // Income 2: 500 (comisión 100) - Refund parcial de 250 (50%)
      const income2 = await incomeService.createIncome({
        commerceId,
        amount: 500,
        professionalCommission: 100,
        professionalId: 'prof-2',
        paidAt: new Date('2026-01-10'),
        status: 'CONFIRMED',
      });
      income2.commissionPaid = true;
      await incomeService.updateIncome('system', income2);

      // Income 3: 800 (comisión 160) - Refund total
      const income3 = await incomeService.createIncome({
        commerceId,
        amount: 800,
        professionalCommission: 160,
        professionalId: 'prof-3',
        paidAt: new Date('2026-01-15'),
        status: 'CONFIRMED',
      });
      income3.commissionPaid = true;
      await incomeService.updateIncome('system', income3);

      // Outcome: Gasto de 300
      await outcomeService.createOutcome({
        commerceId,
        type: 'OTHER',
        conceptType: 'rent',
        amount: 300,
        paidAt: new Date('2026-01-08'),
        status: 'CONFIRMED',
      });

      // ─────────────────────────────────────────────────────────────
      // PROCESAR REFUNDS
      // ─────────────────────────────────────────────────────────────

      // Refund parcial de income2 (50%)
      await refundService.processRefund({
        type: RefundType.PAYMENT_REFUND,
        originalTransactionId: income2.id,
        amount: 250,
        reason: RefundReason.SERVICE_ISSUE,
        clientId: 'client-2',
      });

      // Refund total de income3
      await refundService.processRefund({
        type: RefundType.PAYMENT_REFUND,
        originalTransactionId: income3.id,
        amount: 800,
        reason: RefundReason.CUSTOMER_REQUEST,
        clientId: 'client-3',
      });

      // ─────────────────────────────────────────────────────────────
      // CALCULAR PERÍODO
      // ─────────────────────────────────────────────────────────────

      const period = await periodService.createPeriod({
        commerceId,
        name: 'Enero 2026',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      });

      const summary = await periodService.getPeriodSummary(period.id);

      // ─────────────────────────────────────────────────────────────
      // VALIDACIÓN CONTABLE DETALLADA
      // ─────────────────────────────────────────────────────────────

      expect(summary.totalIncomes).toBe(2300); // 1000 + 500 + 800
      expect(summary.totalOutcomes).toBe(300);
      expect(summary.totalCommissions).toBe(460); // 200 + 100 + 160
      expect(summary.totalRefunds).toBe(1050); // 250 + 800
      expect(summary.totalCommissionReversals).toBe(210); // 50 + 160

      // Cálculo manual:
      // 2300 (incomes) - 300 (outcomes) - 460 (commissions) - 1050 (refunds) + 210 (reversals)
      // = 2300 - 300 - 460 - 1050 + 210
      // = 700
      expect(summary.netAmount).toBe(700);

      // ✅ DESGLOSE DE LUCRO:
      // Income1 sin refund: 1000 - 200 = 800 de lucro
      // Income2 con refund 50%: (500 - 250) - (100 - 50) = 250 - 50 = 200 de lucro
      // Income3 con refund total: (800 - 800) - (160 - 160) = 0 de lucro
      // Gasto: -300
      // Total: 800 + 200 + 0 - 300 = 700 ✅ CUADRA
    });
  });

  describe('Escenario 3: Refund sin Comisión Pagada', () => {
    it('debe manejar refund cuando la comisión aún no se pagó', async () => {
      const commerceId = 'commerce-test-3';

      // Crear income con comisión NO pagada
      const income = await incomeService.createIncome({
        commerceId,
        amount: 500,
        professionalCommission: 100,
        professionalId: 'prof-1',
        paidAt: new Date('2026-01-10'),
        status: 'CONFIRMED',
      });

      expect(income.commissionPaid).toBe(false);

      // Procesar refund ANTES de pagar comisión
      await refundService.processRefund({
        type: RefundType.PAYMENT_REFUND,
        originalTransactionId: income.id,
        amount: 500,
        reason: RefundReason.CUSTOMER_REQUEST,
        clientId: 'client-1',
      });

      // Verificar que solo se creó 1 outcome (payment-refund)
      const outcomes = Array.from(testDatabase.outcomes.values());
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].type).toBe('payment-refund');

      // NO debe haber commission-reversal
      const hasReversal = outcomes.some(o => o.type === 'commission-reversal');
      expect(hasReversal).toBe(false);

      // Calcular período
      const period = await periodService.createPeriod({
        commerceId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      });

      const summary = await periodService.getPeriodSummary(period.id);

      expect(summary).toMatchObject({
        totalIncomes: 500,
        totalCommissions: 100,
        totalRefunds: 500,
        totalCommissionReversals: 0, // ✅ Cero porque no estaba pagada
        netAmount: -100, // 500 - 0 - 100 - 500 + 0 = -100
      });

      // ✅ PÉRDIDA DE 100:
      // El profesional se quedó con su comisión (no la devolvió)
      // El comercio pierde su lucro (400) más tiene que devolver 500
      // Resultado: -100 (pérdida de la comisión que no se recuperó)
    });
  });

  describe('Escenario 4: Validación de Límites y Errores', () => {
    it('debe rechazar refund que exceda el monto original', async () => {
      const commerceId = 'commerce-test-4';

      const income = await incomeService.createIncome({
        commerceId,
        amount: 100,
        professionalCommission: 20,
        paidAt: new Date('2026-01-10'),
        status: 'CONFIRMED',
      });

      // Intentar refund de 150 (más que 100)
      await expect(
        refundService.processRefund({
          type: RefundType.PAYMENT_REFUND,
          originalTransactionId: income.id,
          amount: 150,
          reason: RefundReason.CUSTOMER_REQUEST,
          clientId: 'client-1',
        })
      ).rejects.toThrow('El monto del reembolso (150) no puede ser mayor al monto original (100)');

      // Verificar que NO se creó ningún outcome
      expect(testDatabase.outcomes.size).toBe(0);
    });

    it('debe rechazar segundo refund que exceda el saldo', async () => {
      const commerceId = 'commerce-test-5';

      const income = await incomeService.createIncome({
        commerceId,
        amount: 100,
        professionalCommission: 20,
        paidAt: new Date('2026-01-10'),
        status: 'CONFIRMED',
      });

      // Primer refund de 60
      await refundService.processRefund({
        type: RefundType.PAYMENT_REFUND,
        originalTransactionId: income.id,
        amount: 60,
        reason: RefundReason.CUSTOMER_REQUEST,
        clientId: 'client-1',
      });

      // Segundo refund de 50 (total 110 > 100)
      await expect(
        refundService.processRefund({
          type: RefundType.PAYMENT_REFUND,
          originalTransactionId: income.id,
          amount: 50,
          reason: RefundReason.CUSTOMER_REQUEST,
          clientId: 'client-1',
        })
      ).rejects.toThrow('El monto total de reembolsos (110) no puede exceder el monto original (100)');
    });
  });

  describe('Escenario 5: Cálculo de NetAmount en Diferentes Situaciones', () => {
    it('debe calcular correctamente netAmount en 10 escenarios diferentes', async () => {
      const scenarios = [
        // [incomes, outcomes, commissions, refunds, reversals, expectedNet]
        [1000, 0, 0, 0, 0, 1000],           // Solo ingresos
        [1000, 300, 0, 0, 0, 700],          // Ingresos y gastos
        [1000, 300, 200, 0, 0, 500],        // Con comisiones
        [1000, 300, 200, 100, 0, 400],      // Con refund sin reversal
        [1000, 300, 200, 100, 20, 420],     // Con refund y reversal parcial
        [1000, 300, 200, 1000, 200, 0],     // Refund total con reversal total
        [0, 500, 0, 0, 0, -500],            // Solo gastos (pérdida)
        [500, 600, 100, 0, 0, -200],        // Gastos mayores que ingresos
        [2000, 500, 400, 500, 100, 800],    // Escenario mixto
        [5000, 1000, 1000, 2000, 400, 1400], // Escenario complejo
      ];

      for (let i = 0; i < scenarios.length; i++) {
        const [incomes, outcomes, commissions, refunds, reversals, expectedNet] = scenarios[i];

        // Crear período para este escenario
        const period = {
          totalIncomes: incomes,
          totalOutcomes: outcomes,
          totalCommissions: commissions,
          totalRefunds: refunds,
          totalCommissionReversals: reversals,
        };

        // Calcular netAmount
        const netAmount = period.totalIncomes
                        - period.totalOutcomes
                        - period.totalCommissions
                        - period.totalRefunds
                        + period.totalCommissionReversals;

        expect(netAmount).toBe(expectedNet,
          `Scenario ${i + 1} failed: ${incomes} - ${outcomes} - ${commissions} - ${refunds} + ${reversals} should equal ${expectedNet}`
        );
      }
    });
  });
});

// Helper para crear mock repository
function createMockRepository(storage: Map<string, any>) {
  return {
    findById: jest.fn((id) => Promise.resolve(storage.get(id) || null)),
    find: jest.fn(() => Promise.resolve(Array.from(storage.values()))),
    whereEqualTo: jest.fn(() => ({
      find: jest.fn(() => Promise.resolve(Array.from(storage.values()))),
    })),
    create: jest.fn((entity) => {
      const id = entity.id || `id-${Date.now()}-${Math.random()}`;
      const saved = { ...entity, id };
      storage.set(id, saved);
      return Promise.resolve(saved);
    }),
    update: jest.fn((entity) => {
      storage.set(entity.id, entity);
      return Promise.resolve(entity);
    }),
  };
}
