import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from 'nestjs-fireorm';
import { AccountingPeriodService } from './accounting-period.service';
import { AccountingPeriod } from './model/accounting-period.entity';
import { IncomeService } from '../income/income.service';
import { OutcomeService } from '../outcome/outcome.service';
import { Income } from '../income/model/income.entity';
import { Outcome } from '../outcome/model/outcome.entity';
import { OutcomeStatus } from '../outcome/model/outcome-status.enum';
import { IncomeStatus } from '../income/model/income-status.enum';

describe('AccountingPeriodService - Pruebas de Cálculos Contables', () => {
  let service: AccountingPeriodService;
  let periodRepository: any;
  let incomeService: any;
  let outcomeService: any;

  const mockPeriodRepository = {
    findById: jest.fn(),
    find: jest.fn(),
    whereEqualTo: jest.fn(() => ({
      find: jest.fn(),
    })),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockIncomeService = {
    getIncomeByCommerce: jest.fn(),
  };

  const mockOutcomeService = {
    getOutcomeByCommerce: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingPeriodService,
        {
          provide: getRepositoryToken(AccountingPeriod),
          useValue: mockPeriodRepository,
        },
        {
          provide: IncomeService,
          useValue: mockIncomeService,
        },
        {
          provide: OutcomeService,
          useValue: mockOutcomeService,
        },
      ],
    }).compile();

    service = module.get<AccountingPeriodService>(AccountingPeriodService);
    periodRepository = module.get(getRepositoryToken(AccountingPeriod));
    incomeService = module.get<IncomeService>(IncomeService);
    outcomeService = module.get<OutcomeService>(OutcomeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Caso 1: Período Simple sin Refunds', () => {
    it('debe calcular correctamente: incomes 1000, outcomes 300, commissions 200, net 500', async () => {
      // Arrange
      const period: AccountingPeriod = {
        id: 'period-1',
        commerceId: 'commerce-123',
        name: 'Enero 2026',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        status: 'OPEN',
      } as AccountingPeriod;

      const incomes: Partial<Income>[] = [
        {
          id: 'inc-1',
          amount: 500,
          professionalCommission: 100,
          paidAt: new Date('2026-01-10'),
          status: IncomeStatus.CONFIRMED,
        },
        {
          id: 'inc-2',
          amount: 500,
          professionalCommission: 100,
          paidAt: new Date('2026-01-20'),
          status: IncomeStatus.CONFIRMED,
        },
      ];

      const outcomes: Partial<Outcome>[] = [
        {
          id: 'out-1',
          type: 'OTHER',
          conceptType: 'expenses',
          amount: 150,
          paidAt: new Date('2026-01-15'),
          status: OutcomeStatus.CONFIRMED,
        },
        {
          id: 'out-2',
          type: 'OTHER',
          conceptType: 'expenses',
          amount: 150,
          paidAt: new Date('2026-01-25'),
          status: OutcomeStatus.CONFIRMED,
        },
      ];

      mockPeriodRepository.findById.mockResolvedValue(period);
      mockIncomeService.getIncomeByCommerce.mockResolvedValue(incomes);
      mockOutcomeService.getOutcomeByCommerce.mockResolvedValue(outcomes);

      // Act
      const result = await service.getPeriodSummary('period-1');

      // Assert
      expect(result).toMatchObject({
        totalIncomes: 1000, // 500 + 500
        totalOutcomes: 300, // 150 + 150
        totalCommissions: 200, // 100 + 100
        totalRefunds: 0,
        totalCommissionReversals: 0,
        netAmount: 500, // 1000 - 300 - 200 - 0 + 0 = 500
        incomesCount: 2,
        outcomesCount: 2,
      });

      // ✅ VALIDACIÓN: Lucro = Ingresos - Egresos - Comisiones = 1000 - 300 - 200 = 500
    });
  });

  describe('Caso 2: Período con Refund Total y Commission Reversal', () => {
    it('debe calcular correctamente con refund 100 y commission-reversal 20', async () => {
      // Arrange:
      // Income: 100 (comisión 20)
      // Outcome: 50 (gasto normal)
      // Refund: -100 (devolución al cliente)
      // Commission Reversal: +20 (profesional devuelve comisión)
      const period: AccountingPeriod = {
        id: 'period-1',
        commerceId: 'commerce-123',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        status: 'OPEN',
      } as AccountingPeriod;

      const incomes: Partial<Income>[] = [
        {
          id: 'inc-1',
          amount: 100,
          professionalCommission: 20,
          paidAt: new Date('2026-01-10'),
          status: IncomeStatus.CONFIRMED,
        },
      ];

      const outcomes: Partial<Outcome>[] = [
        {
          id: 'out-1',
          type: 'OTHER',
          conceptType: 'expenses',
          amount: 50,
          paidAt: new Date('2026-01-15'),
          status: OutcomeStatus.CONFIRMED,
        },
        {
          id: 'out-2',
          type: 'payment-refund',
          conceptType: 'payment-refund',
          amount: 100,
          paidAt: new Date('2026-01-20'),
          status: OutcomeStatus.CONFIRMED,
        },
        {
          id: 'out-3',
          type: 'commission-reversal',
          conceptType: 'commission-reversal',
          amount: 20,
          paidAt: new Date('2026-01-20'),
          status: OutcomeStatus.CONFIRMED,
        },
      ];

      mockPeriodRepository.findById.mockResolvedValue(period);
      mockIncomeService.getIncomeByCommerce.mockResolvedValue(incomes);
      mockOutcomeService.getOutcomeByCommerce.mockResolvedValue(outcomes);

      // Act
      const result = await service.getPeriodSummary('period-1');

      // Assert
      expect(result).toMatchObject({
        totalIncomes: 100,
        totalOutcomes: 50, // Solo el gasto normal
        totalCommissions: 20,
        totalRefunds: 100, // ✅ Refund separado
        totalCommissionReversals: 20, // ✅ Reversión separada
        netAmount: -50, // 100 - 50 - 20 - 100 + 20 = -50
        incomesCount: 1,
        outcomesCount: 1, // Solo cuenta el gasto normal
      });

      // ✅ VALIDACIÓN CONTABLE:
      // Lucro antes de refund: 100 - 50 - 20 = 30
      // Después de refund: -100 (cliente) + 20 (profesional) = -80
      // Lucro neto: 30 - 80 = -50 ✅ PÉRDIDA (porque era nuestro lucro)
    });
  });

  describe('Caso 3: Período con Refund Parcial (50%)', () => {
    it('debe calcular correctamente con refund parcial de 50 y commission-reversal de 10', async () => {
      // Arrange: Income 100 (comisión 20), refund parcial 50
      const period: AccountingPeriod = {
        id: 'period-1',
        commerceId: 'commerce-123',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        status: 'OPEN',
      } as AccountingPeriod;

      const incomes: Partial<Income>[] = [
        {
          id: 'inc-1',
          amount: 100,
          professionalCommission: 20,
          paidAt: new Date('2026-01-10'),
          status: IncomeStatus.CONFIRMED,
        },
      ];

      const outcomes: Partial<Outcome>[] = [
        {
          id: 'out-1',
          type: 'payment-refund',
          conceptType: 'payment-refund',
          amount: 50, // 50% refund
          paidAt: new Date('2026-01-20'),
          status: OutcomeStatus.CONFIRMED,
        },
        {
          id: 'out-2',
          type: 'commission-reversal',
          conceptType: 'commission-reversal',
          amount: 10, // 50% de la comisión
          paidAt: new Date('2026-01-20'),
          status: OutcomeStatus.CONFIRMED,
        },
      ];

      mockPeriodRepository.findById.mockResolvedValue(period);
      mockIncomeService.getIncomeByCommerce.mockResolvedValue(incomes);
      mockOutcomeService.getOutcomeByCommerce.mockResolvedValue(outcomes);

      // Act
      const result = await service.getPeriodSummary('period-1');

      // Assert
      expect(result).toMatchObject({
        totalIncomes: 100,
        totalOutcomes: 0,
        totalCommissions: 20,
        totalRefunds: 50,
        totalCommissionReversals: 10,
        netAmount: 40, // 100 - 0 - 20 - 50 + 10 = 40
        incomesCount: 1,
        outcomesCount: 0,
      });

      // ✅ VALIDACIÓN CONTABLE:
      // Lucro original: 100 - 20 = 80
      // Después de refund parcial: -50 + 10 = -40
      // Lucro neto: 80 - 40 = 40 ✅ Mantiene 50% del lucro original
    });
  });

  describe('Caso 4: Período con Múltiples Transacciones Complejas', () => {
    it('debe calcular correctamente un escenario real complejo', async () => {
      // Arrange: Escenario real de un mes
      const period: AccountingPeriod = {
        id: 'period-1',
        commerceId: 'commerce-123',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        status: 'OPEN',
      } as AccountingPeriod;

      const incomes: Partial<Income>[] = [
        { id: 'inc-1', amount: 1000, professionalCommission: 200, paidAt: new Date('2026-01-05'), status: IncomeStatus.CONFIRMED },
        { id: 'inc-2', amount: 500, professionalCommission: 100, paidAt: new Date('2026-01-10'), status: IncomeStatus.CONFIRMED },
        { id: 'inc-3', amount: 800, professionalCommission: 160, paidAt: new Date('2026-01-15'), status: IncomeStatus.CONFIRMED },
        { id: 'inc-4', amount: 300, professionalCommission: 60, paidAt: new Date('2026-01-20'), status: IncomeStatus.CONFIRMED },
        { id: 'inc-5', amount: 1200, professionalCommission: 240, paidAt: new Date('2026-01-25'), status: IncomeStatus.CONFIRMED },
      ];
      // Total incomes: 3800, Total commissions: 760

      const outcomes: Partial<Outcome>[] = [
        // Gastos normales
        { id: 'out-1', type: 'OTHER', conceptType: 'rent', amount: 500, paidAt: new Date('2026-01-05'), status: OutcomeStatus.CONFIRMED },
        { id: 'out-2', type: 'OTHER', conceptType: 'utilities', amount: 200, paidAt: new Date('2026-01-10'), status: OutcomeStatus.CONFIRMED },
        { id: 'out-3', type: 'OTHER', conceptType: 'supplies', amount: 150, paidAt: new Date('2026-01-15'), status: OutcomeStatus.CONFIRMED },
        // Total outcomes: 850

        // Refund parcial de inc-2 (50%)
        { id: 'refund-1', type: 'payment-refund', conceptType: 'payment-refund', amount: 250, paidAt: new Date('2026-01-18'), status: OutcomeStatus.CONFIRMED },
        { id: 'reversal-1', type: 'commission-reversal', conceptType: 'commission-reversal', amount: 50, paidAt: new Date('2026-01-18'), status: OutcomeStatus.CONFIRMED },

        // Refund total de inc-4
        { id: 'refund-2', type: 'payment-refund', conceptType: 'payment-refund', amount: 300, paidAt: new Date('2026-01-22'), status: OutcomeStatus.CONFIRMED },
        { id: 'reversal-2', type: 'commission-reversal', conceptType: 'commission-reversal', amount: 60, paidAt: new Date('2026-01-22'), status: OutcomeStatus.CONFIRMED },
        // Total refunds: 550, Total reversals: 110
      ];

      mockPeriodRepository.findById.mockResolvedValue(period);
      mockIncomeService.getIncomeByCommerce.mockResolvedValue(incomes);
      mockOutcomeService.getOutcomeByCommerce.mockResolvedValue(outcomes);

      // Act
      const result = await service.getPeriodSummary('period-1');

      // Assert
      expect(result).toMatchObject({
        totalIncomes: 3800,
        totalOutcomes: 850,
        totalCommissions: 760,
        totalRefunds: 550,
        totalCommissionReversals: 110,
        netAmount: 2700, // 3800 - 850 - 760 - 550 + 110 = 2750 - 50 = 2700
        incomesCount: 5,
        outcomesCount: 3,
      });

      // ✅ VALIDACIÓN CONTABLE DETALLADA:
      // Ingresos brutos: 3800
      // Gastos operacionales: -850
      // Comisiones profesionales: -760
      // Reembolsos a clientes: -550
      // Comisiones recuperadas: +110
      // ───────────────────────────
      // Lucro neto: 2700 ✅
    });
  });

  describe('Caso 5: Filtrado por Fechas', () => {
    it('debe excluir transacciones fuera del período', async () => {
      const period: AccountingPeriod = {
        id: 'period-1',
        commerceId: 'commerce-123',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        status: 'OPEN',
      } as AccountingPeriod;

      const incomes: Partial<Income>[] = [
        { id: 'inc-1', amount: 100, professionalCommission: 20, paidAt: new Date('2025-12-31'), status: IncomeStatus.CONFIRMED }, // Excluir
        { id: 'inc-2', amount: 200, professionalCommission: 40, paidAt: new Date('2026-01-15'), status: IncomeStatus.CONFIRMED }, // Incluir
        { id: 'inc-3', amount: 300, professionalCommission: 60, paidAt: new Date('2026-02-01'), status: IncomeStatus.CONFIRMED }, // Excluir
      ];

      const outcomes: Partial<Outcome>[] = [
        { id: 'out-1', type: 'OTHER', conceptType: 'expenses', amount: 50, paidAt: new Date('2025-12-31'), status: OutcomeStatus.CONFIRMED }, // Excluir
        { id: 'out-2', type: 'OTHER', conceptType: 'expenses', amount: 75, paidAt: new Date('2026-01-20'), status: OutcomeStatus.CONFIRMED }, // Incluir
        { id: 'out-3', type: 'OTHER', conceptType: 'expenses', amount: 100, paidAt: new Date('2026-02-01'), status: OutcomeStatus.CONFIRMED }, // Excluir
      ];

      mockPeriodRepository.findById.mockResolvedValue(period);
      mockIncomeService.getIncomeByCommerce.mockResolvedValue(incomes);
      mockOutcomeService.getOutcomeByCommerce.mockResolvedValue(outcomes);

      // Act
      const result = await service.getPeriodSummary('period-1');

      // Assert - Solo inc-2 y out-2 deben contarse
      expect(result).toMatchObject({
        totalIncomes: 200,
        totalOutcomes: 75,
        totalCommissions: 40,
        netAmount: 85, // 200 - 75 - 40 = 85
        incomesCount: 1,
        outcomesCount: 1,
      });
    });
  });

  describe('Caso 6: Status Filtering', () => {
    it('debe incluir solo transacciones CONFIRMED y refunds/reversals independientemente del status', async () => {
      const period: AccountingPeriod = {
        id: 'period-1',
        commerceId: 'commerce-123',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        status: 'OPEN',
      } as AccountingPeriod;

      const incomes: Partial<Income>[] = [
        { id: 'inc-1', amount: 100, professionalCommission: 20, paidAt: new Date('2026-01-10'), status: IncomeStatus.CONFIRMED },
        { id: 'inc-2', amount: 200, professionalCommission: 40, paidAt: new Date('2026-01-15'), status: 'PENDING' as any }, // Excluir
      ];

      const outcomes: Partial<Outcome>[] = [
        { id: 'out-1', type: 'OTHER', conceptType: 'expenses', amount: 50, paidAt: new Date('2026-01-10'), status: OutcomeStatus.CONFIRMED },
        { id: 'out-2', type: 'OTHER', conceptType: 'expenses', amount: 30, paidAt: new Date('2026-01-12'), status: 'PENDING' as any }, // Excluir
        { id: 'out-3', type: 'payment-refund', conceptType: 'payment-refund', amount: 100, paidAt: new Date('2026-01-20'), status: 'PENDING' as any }, // ✅ Incluir (refund)
        { id: 'out-4', type: 'commission-reversal', conceptType: 'commission-reversal', amount: 20, paidAt: new Date('2026-01-20'), status: 'PENDING' as any }, // ✅ Incluir (reversal)
      ];

      mockPeriodRepository.findById.mockResolvedValue(period);
      mockIncomeService.getIncomeByCommerce.mockResolvedValue(incomes);
      mockOutcomeService.getOutcomeByCommerce.mockResolvedValue(outcomes);

      // Act
      const result = await service.getPeriodSummary('period-1');

      // Assert
      expect(result).toMatchObject({
        totalIncomes: 100, // Solo inc-1
        totalOutcomes: 50, // Solo out-1
        totalCommissions: 20,
        totalRefunds: 100, // ✅ out-3 incluido aunque sea PENDING
        totalCommissionReversals: 20, // ✅ out-4 incluido aunque sea PENDING
        netAmount: -50, // 100 - 50 - 20 - 100 + 20 = -50
      });
    });
  });

  describe('Caso 7: Validación de Cálculo de NetAmount', () => {
    it('debe calcular netAmount con la fórmula correcta', async () => {
      const period: AccountingPeriod = {
        id: 'period-1',
        commerceId: 'commerce-123',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        status: 'OPEN',
      } as AccountingPeriod;

      // Valores específicos para validar fórmula
      const incomes: Partial<Income>[] = [
        { id: 'inc-1', amount: 5000, professionalCommission: 1000, paidAt: new Date('2026-01-10'), status: IncomeStatus.CONFIRMED },
      ];

      const outcomes: Partial<Outcome>[] = [
        { id: 'out-1', type: 'OTHER', conceptType: 'expenses', amount: 800, paidAt: new Date('2026-01-15'), status: OutcomeStatus.CONFIRMED },
        { id: 'refund-1', type: 'payment-refund', conceptType: 'payment-refund', amount: 1500, paidAt: new Date('2026-01-20'), status: OutcomeStatus.CONFIRMED },
        { id: 'reversal-1', type: 'commission-reversal', conceptType: 'commission-reversal', amount: 300, paidAt: new Date('2026-01-20'), status: OutcomeStatus.CONFIRMED },
      ];

      mockPeriodRepository.findById.mockResolvedValue(period);
      mockIncomeService.getIncomeByCommerce.mockResolvedValue(incomes);
      mockOutcomeService.getOutcomeByCommerce.mockResolvedValue(outcomes);

      // Act
      const result = await service.getPeriodSummary('period-1');

      // Assert - Validar fórmula exacta
      const expectedNetAmount = 5000 - 800 - 1000 - 1500 + 300;
      expect(result.netAmount).toBe(expectedNetAmount); // 5000 - 800 - 1000 - 1500 + 300 = 2000

      // ✅ FÓRMULA VERIFICADA:
      // netAmount = totalIncomes - totalOutcomes - totalCommissions - totalRefunds + totalCommissionReversals
      //           = 5000 - 800 - 1000 - 1500 + 300
      //           = 2000 ✅
    });
  });

  describe('Caso 8: Período Vacío', () => {
    it('debe retornar todos los valores en 0 para período sin transacciones', async () => {
      const period: AccountingPeriod = {
        id: 'period-1',
        commerceId: 'commerce-123',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        status: 'OPEN',
      } as AccountingPeriod;

      mockPeriodRepository.findById.mockResolvedValue(period);
      mockIncomeService.getIncomeByCommerce.mockResolvedValue([]);
      mockOutcomeService.getOutcomeByCommerce.mockResolvedValue([]);

      // Act
      const result = await service.getPeriodSummary('period-1');

      // Assert
      expect(result).toMatchObject({
        totalIncomes: 0,
        totalOutcomes: 0,
        totalCommissions: 0,
        totalRefunds: 0,
        totalCommissionReversals: 0,
        netAmount: 0,
        incomesCount: 0,
        outcomesCount: 0,
      });
    });
  });
});
