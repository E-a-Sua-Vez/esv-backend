import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from 'nestjs-fireorm';
import { AccountingPeriodService } from './accounting-period.service';
import { Income } from '../../../income/model/income.entity';
import { Outcome } from '../../../outcome/model/outcome.entity';
import { OutcomeService } from '../../../outcome/outcome.service';
import { IncomeService } from '../../../income/income.service';
import { CreatePeriodDto, PeriodType } from '../dto/create-period.dto';
import { OutcomeType } from '../../../outcome/model/outcome-type.enum';

describe('AccountingPeriodService - Pruebas Financieras Actualizadas', () => {
  let service: AccountingPeriodService;
  let incomeRepository: any;
  let outcomeRepository: any;
  let outcomeService: any;
  let incomeService: any;

  const mockIncomeRepository = {
    find: jest.fn(),
    whereArrayContains: jest.fn(() => ({
      find: jest.fn(),
    })),
    whereGreaterOrEqualThan: jest.fn(() => ({
      whereGreaterOrEqualThan: jest.fn(() => ({
        find: jest.fn(),
      })),
      whereLessOrEqualThan: jest.fn(() => ({
        find: jest.fn(),
      })),
      find: jest.fn(),
    })),
    whereLessOrEqualThan: jest.fn(() => ({
      find: jest.fn(),
    })),
  };

  const mockOutcomeRepository = {
    find: jest.fn(),
    whereArrayContains: jest.fn(() => ({
      find: jest.fn(),
    })),
    whereGreaterOrEqualThan: jest.fn(() => ({
      whereGreaterOrEqualThan: jest.fn(() => ({
        find: jest.fn(),
      })),
      whereLessOrEqualThan: jest.fn(() => ({
        find: jest.fn(),
      })),
      find: jest.fn(),
    })),
    whereLessOrEqualThan: jest.fn(() => ({
      find: jest.fn(),
    })),
  };

  const mockOutcomeService = {
    getOutcomesByDateRange: jest.fn(),
  };

  const mockIncomeService = {
    getIncomesByDateRange: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingPeriodService,
        {
          provide: getRepositoryToken(Income),
          useValue: mockIncomeRepository,
        },
        {
          provide: getRepositoryToken(Outcome),
          useValue: mockOutcomeRepository,
        },
        {
          provide: OutcomeService,
          useValue: mockOutcomeService,
        },
        {
          provide: IncomeService,
          useValue: mockIncomeService,
        },
      ],
    }).compile();

    service = module.get<AccountingPeriodService>(AccountingPeriodService);
    incomeRepository = module.get(getRepositoryToken(Income));
    outcomeRepository = module.get(getRepositoryToken(Outcome));
    outcomeService = module.get<OutcomeService>(OutcomeService);
    incomeService = module.get<IncomeService>(IncomeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPeriodTransactions - Enhanced with Refunds and Commission Reversals', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    const mockIncomes = [
      {
        id: 'income-1',
        amount: 1000,
        professionalCommission: 200,
        paidAt: new Date('2024-01-15'),
        refundMetadata: {
          hasFullRefund: true,
          fullRefundId: 'refund-1',
          fullRefundDate: new Date('2024-01-20'),
          totalRefundAmount: 1000,
        },
      },
      {
        id: 'income-2',
        amount: 2000,
        professionalCommission: 400,
        paidAt: new Date('2024-01-10'),
        refundMetadata: {
          hasPartialRefund: true,
          partialRefunds: [
            { id: 'refund-2', amount: 500, date: new Date('2024-01-25') },
          ],
          totalRefundAmount: 500,
          commissionReversals: [
            { amount: 100, date: new Date('2024-01-25') },
          ],
        },
      },
      {
        id: 'income-3',
        amount: 1500,
        professionalCommission: 300,
        paidAt: new Date('2024-01-05'),
        refundMetadata: {},
      },
    ];

    const mockOutcomes = [
      {
        id: 'outcome-1',
        amount: 300,
        type: OutcomeType.BUSINESS_EXPENSE,
        paidAt: new Date('2024-01-12'),
      },
      {
        id: 'refund-1',
        amount: 1000,
        type: OutcomeType.REFUND,
        paidAt: new Date('2024-01-20'),
        relatedIncomeId: 'income-1',
      },
      {
        id: 'refund-2',
        amount: 500,
        type: OutcomeType.REFUND,
        paidAt: new Date('2024-01-25'),
        relatedIncomeId: 'income-2',
      },
      {
        id: 'commission-reversal-1',
        amount: 100,
        type: OutcomeType.COMMISSION_REVERSAL,
        paidAt: new Date('2024-01-25'),
        relatedIncomeId: 'income-2',
      },
    ];

    beforeEach(() => {
      mockIncomeService.getIncomesByDateRange.mockResolvedValue(mockIncomes);
      mockOutcomeService.getOutcomesByDateRange.mockResolvedValue(mockOutcomes);
    });

    it('DEBE incluir todos los refunds y commission reversals en el período', async () => {
      const result = await service.getPeriodTransactions(startDate, endDate);

      expect(result.incomes).toHaveLength(3);
      expect(result.outcomes).toHaveLength(4);

      // Verificar que incluye refunds
      const refunds = result.outcomes.filter(o => o.type === OutcomeType.REFUND);
      expect(refunds).toHaveLength(2);
      expect(refunds.map(r => r.amount)).toEqual([1000, 500]);

      // Verificar que incluye commission reversals
      const commissionReversals = result.outcomes.filter(o => o.type === OutcomeType.COMMISSION_REVERSAL);
      expect(commissionReversals).toHaveLength(1);
      expect(commissionReversals[0].amount).toBe(100);
    });

    it('DEBE manejar refunds con fecha null usando refundMetadata', async () => {
      const mockOutcomesWithNullDate = [
        ...mockOutcomes,
        {
          id: 'refund-3',
          amount: 300,
          type: OutcomeType.REFUND,
          paidAt: null, // Fecha null
          relatedIncomeId: 'income-3',
        },
      ];

      mockOutcomeService.getOutcomesByDateRange.mockResolvedValue(mockOutcomesWithNullDate);

      // Mock income con refund metadata que tiene fecha
      const mockIncomesWithRefundDate = [
        ...mockIncomes,
        {
          id: 'income-3',
          amount: 1500,
          paidAt: new Date('2024-01-05'),
          refundMetadata: {
            hasPartialRefund: true,
            partialRefunds: [
              { id: 'refund-3', amount: 300, date: new Date('2024-01-18') },
            ],
          },
        },
      ];

      mockIncomeService.getIncomesByDateRange.mockResolvedValue(mockIncomesWithRefundDate);

      const result = await service.getPeriodTransactions(startDate, endDate);

      // Debe incluir el refund aunque tenga paidAt null
      const refund3 = result.outcomes.find(o => o.id === 'refund-3');
      expect(refund3).toBeDefined();
      expect(refund3.amount).toBe(300);
    });

    it('DEBE calcular totales correctos con refunds incluidos', async () => {
      const result = await service.getPeriodTransactions(startDate, endDate);

      const calculations = service.calculatePeriodSummary(result);

      // Total incomes: 1000 + 2000 + 1500 = 4500
      expect(calculations.totalIncomes).toBe(4500);

      // Total outcomes: 300 (business) + 1000 (refund-1) + 500 (refund-2) + 100 (commission-reversal) = 1900
      expect(calculations.totalOutcomes).toBe(1900);

      // Net profit: 4500 - 1900 = 2600
      expect(calculations.netProfit).toBe(2600);

      // Refunds totales: 1000 + 500 = 1500
      expect(calculations.totalRefunds).toBe(1500);

      // Commission reversals totales: 100
      expect(calculations.totalCommissionReversals).toBe(100);
    });
  });

  describe('generatePeriodReport - Enhanced', () => {
    const mockPeriodData = {
      incomes: [
        {
          id: 'income-1',
          amount: 1000,
          description: 'Test income',
          paidAt: new Date('2024-01-15'),
          refundMetadata: {
            hasFullRefund: true,
            fullRefundId: 'refund-1',
            totalRefundAmount: 1000,
          },
        },
      ],
      outcomes: [
        {
          id: 'refund-1',
          amount: 1000,
          type: OutcomeType.REFUND,
          description: 'Full refund',
          paidAt: new Date('2024-01-20'),
          relatedIncomeId: 'income-1',
        },
        {
          id: 'outcome-1',
          amount: 200,
          type: OutcomeType.BUSINESS_EXPENSE,
          description: 'Business expense',
          paidAt: new Date('2024-01-12'),
        },
      ],
    };

    beforeEach(() => {
      jest.spyOn(service, 'getPeriodTransactions').mockResolvedValue(mockPeriodData);
    });

    it('DEBE incluir refunds y commission reversals en el reporte Excel', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const result = await service.generatePeriodReport(startDate, endDate, 'xlsx');

      expect(result).toBeDefined();
      expect(result.buffer).toBeDefined();
      expect(result.filename).toContain('.xlsx');

      // Verificar que getPeriodTransactions fue llamado
      expect(service.getPeriodTransactions).toHaveBeenCalledWith(startDate, endDate);
    });

    it('DEBE manejar campo faltante en mapeo de datos', async () => {
      const mockDataWithMissingFields = {
        incomes: [
          {
            id: 'income-missing-field',
            amount: 500,
            // description missing
            paidAt: new Date('2024-01-10'),
          },
        ],
        outcomes: [
          {
            id: 'outcome-missing-field',
            amount: 100,
            type: OutcomeType.REFUND,
            // description and paidAt missing
          },
        ],
      };

      jest.spyOn(service, 'getPeriodTransactions').mockResolvedValue(mockDataWithMissingFields);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // No debe lanzar error por campos faltantes
      const result = await service.generatePeriodReport(startDate, endDate, 'csv');
      expect(result).toBeDefined();
    });
  });

  describe('calculatePeriodSummary - Enhanced Financial Calculations', () => {
    const sampleData = {
      incomes: [
        {
          id: 'income-1',
          amount: 1000,
          professionalCommission: 200,
          paymentMethodFee: 50,
          refundMetadata: {
            hasFullRefund: true,
            totalRefundAmount: 1000,
          },
        },
        {
          id: 'income-2',
          amount: 2000,
          professionalCommission: 400,
          paymentMethodFee: 100,
          refundMetadata: {
            hasPartialRefund: true,
            totalRefundAmount: 500,
            commissionReversals: [{ amount: 100 }],
          },
        },
      ],
      outcomes: [
        {
          id: 'refund-1',
          amount: 1000,
          type: OutcomeType.REFUND,
        },
        {
          id: 'refund-2-partial',
          amount: 500,
          type: OutcomeType.REFUND,
        },
        {
          id: 'commission-reversal-1',
          amount: 100,
          type: OutcomeType.COMMISSION_REVERSAL,
        },
        {
          id: 'business-expense',
          amount: 300,
          type: OutcomeType.BUSINESS_EXPENSE,
        },
      ],
    };

    it('DEBE calcular correctamente totales con refunds y commission reversals', () => {
      const result = service.calculatePeriodSummary(sampleData);

      // Total incomes: 1000 + 2000 = 3000
      expect(result.totalIncomes).toBe(3000);

      // Total outcomes: 1000 + 500 + 100 + 300 = 1900
      expect(result.totalOutcomes).toBe(1900);

      // Net profit: 3000 - 1900 = 1100
      expect(result.netProfit).toBe(1100);

      // Refunds: 1000 + 500 = 1500
      expect(result.totalRefunds).toBe(1500);

      // Commission reversals: 100
      expect(result.totalCommissionReversals).toBe(100);

      // Professional commissions: 200 + 400 = 600
      expect(result.totalProfessionalCommissions).toBe(600);

      // Payment method fees: 50 + 100 = 150
      expect(result.totalPaymentMethodFees).toBe(150);
    });

    it('DEBE manejar datos sin refunds ni commission reversals', () => {
      const dataWithoutRefunds = {
        incomes: [
          {
            id: 'income-1',
            amount: 1500,
            professionalCommission: 300,
          },
        ],
        outcomes: [
          {
            id: 'expense-1',
            amount: 200,
            type: OutcomeType.BUSINESS_EXPENSE,
          },
        ],
      };

      const result = service.calculatePeriodSummary(dataWithoutRefunds);

      expect(result.totalIncomes).toBe(1500);
      expect(result.totalOutcomes).toBe(200);
      expect(result.netProfit).toBe(1300);
      expect(result.totalRefunds).toBe(0);
      expect(result.totalCommissionReversals).toBe(0);
    });

    it('DEBE categorizar correctamente diferentes tipos de outcomes', () => {
      const diverseData = {
        incomes: [{ id: 'income-1', amount: 2000 }],
        outcomes: [
          { id: 'refund-1', amount: 500, type: OutcomeType.REFUND },
          { id: 'commission-rev-1', amount: 100, type: OutcomeType.COMMISSION_REVERSAL },
          { id: 'business-exp-1', amount: 200, type: OutcomeType.BUSINESS_EXPENSE },
          { id: 'professional-comm-1', amount: 150, type: OutcomeType.PROFESSIONAL_COMMISSION },
          { id: 'payment-fee-1', amount: 50, type: OutcomeType.PAYMENT_METHOD_FEE },
        ],
      };

      const result = service.calculatePeriodSummary(diverseData);

      expect(result.totalRefunds).toBe(500);
      expect(result.totalCommissionReversals).toBe(100);
      
      // Total outcomes incluye todos los tipos
      expect(result.totalOutcomes).toBe(1000); // 500+100+200+150+50
      expect(result.netProfit).toBe(1000); // 2000-1000
    });
  });

  describe('Date Range Handling - Enhanced', () => {
    it('DEBE manejar correctamente rangos de fechas con refunds', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const incomesInRange = [
        {
          id: 'income-in-range',
          amount: 1000,
          paidAt: new Date('2024-01-15'),
          refundMetadata: {
            hasPartialRefund: true,
            partialRefunds: [
              { id: 'refund-outside-range', amount: 300, date: new Date('2024-02-05') },
            ],
          },
        },
      ];

      const outcomesInRange = [
        {
          id: 'refund-in-range',
          amount: 200,
          type: OutcomeType.REFUND,
          paidAt: new Date('2024-01-20'),
        },
      ];

      mockIncomeService.getIncomesByDateRange.mockResolvedValue(incomesInRange);
      mockOutcomeService.getOutcomesByDateRange.mockResolvedValue(outcomesInRange);

      const result = await service.getPeriodTransactions(startDate, endDate);

      expect(mockIncomeService.getIncomesByDateRange).toHaveBeenCalledWith(startDate, endDate);
      expect(mockOutcomeService.getOutcomesByDateRange).toHaveBeenCalledWith(startDate, endDate);
      
      expect(result.incomes).toHaveLength(1);
      expect(result.outcomes).toHaveLength(1);
    });

    it('DEBE incluir refunds con fecha null si income está en rango', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const incomesInRange = [
        {
          id: 'income-with-null-refund',
          amount: 1000,
          paidAt: new Date('2024-01-15'),
          refundMetadata: {
            hasFullRefund: true,
            fullRefundId: 'refund-null-date',
            fullRefundDate: new Date('2024-01-18'),
          },
        },
      ];

      const outcomesWithNullDate = [
        {
          id: 'refund-null-date',
          amount: 1000,
          type: OutcomeType.REFUND,
          paidAt: null, // Fecha null
          relatedIncomeId: 'income-with-null-refund',
        },
      ];

      mockIncomeService.getIncomesByDateRange.mockResolvedValue(incomesInRange);
      mockOutcomeService.getOutcomesByDateRange.mockResolvedValue(outcomesWithNullDate);

      const result = await service.getPeriodTransactions(startDate, endDate);

      // Debe incluir el refund aunque tenga paidAt null
      expect(result.outcomes).toHaveLength(1);
      expect(result.outcomes[0].id).toBe('refund-null-date');
    });
  });

  describe('Error Handling', () => {
    it('DEBE manejar errores en servicios de datos', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockIncomeService.getIncomesByDateRange.mockRejectedValue(new Error('Database error'));

      await expect(
        service.getPeriodTransactions(startDate, endDate),
      ).rejects.toThrow('Database error');
    });

    it('DEBE manejar datos vacíos sin error', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockIncomeService.getIncomesByDateRange.mockResolvedValue([]);
      mockOutcomeService.getOutcomesByDateRange.mockResolvedValue([]);

      const result = await service.getPeriodTransactions(startDate, endDate);

      expect(result.incomes).toHaveLength(0);
      expect(result.outcomes).toHaveLength(0);

      const summary = service.calculatePeriodSummary(result);
      expect(summary.totalIncomes).toBe(0);
      expect(summary.totalOutcomes).toBe(0);
      expect(summary.netProfit).toBe(0);
    });
  });
});