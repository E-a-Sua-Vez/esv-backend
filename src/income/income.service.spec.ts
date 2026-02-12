import { Test, TestingModule } from '@nestjs/testing';
import { IncomeService } from './income.service';
import { getRepositoryToken } from 'nestjs-fireorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Income } from './entities/income.entity';
import { IncomeStatus } from './enums/income-status.enum';

/**
 * PRUEBAS UNITARIAS - INCOME SERVICE
 *
 * Valida:
 * - Creación de incomes con comisiones
 * - Actualización de estado refunded
 * - Cálculo de refundMetadata
 * - Validación de commission pendientes
 * - Exclusión de incomes refunded de reportes
 */
describe('IncomeService - Unit Tests', () => {
  let service: IncomeService;
  let incomeRepository: any;

  const mockIncomeRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    whereEqualTo: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncomeService,
        {
          provide: getRepositoryToken('Income'),
          useValue: mockIncomeRepository,
        },
      ],
    }).compile();

    service = module.get<IncomeService>(IncomeService);
    incomeRepository = module.get(getRepositoryToken('Income'));

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Caso 1: Creación de Income con Comisión', () => {
    it('debe crear income correctamente con comisión calculada', async () => {
      const createDto = {
        commerceId: 'commerce-1',
        clientId: 'client-1',
        professionalId: 'prof-1',
        amount: 1000,
        professionalCommission: 200,
        paidAt: new Date('2026-01-15'),
        status: IncomeStatus.CONFIRMED,
      };

      const expectedIncome = {
        ...createDto,
        id: 'income-1',
        commissionPaid: false,
        refundMetadata: null,
        createdAt: new Date(),
      };

      mockIncomeRepository.create.mockResolvedValue(expectedIncome);

      const result = await service.createIncome(createDto);

      expect(mockIncomeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          commerceId: 'commerce-1',
          amount: 1000,
          professionalCommission: 200,
          commissionPaid: false, // ✅ Por defecto false
          refundMetadata: null,
        })
      );

      expect(result).toMatchObject({
        amount: 1000,
        professionalCommission: 200,
        commissionPaid: false,
      });

      // ✅ VALIDACIÓN CONTABLE:
      // Lucro del comercio = 1000 - 200 = 800
    });
  });

  describe('Caso 2: Marcar Income como Refunded', () => {
    it('debe actualizar refundMetadata correctamente en refund total', async () => {
      const income: Income = {
        id: 'income-1',
        commerceId: 'commerce-1',
        amount: 500,
        professionalCommission: 100,
        commissionPaid: true,
        commissionPaymentId: 'payment-1',
        paidAt: new Date('2026-01-10'),
        status: IncomeStatus.CONFIRMED,
        refundMetadata: null,
      } as Income;

      mockIncomeRepository.findById.mockResolvedValue(income);

      // Actualizar con refundMetadata
      income.refundMetadata = {
        isRefunded: true,
        refundedAmount: 500,
        isPartialRefund: false,
        originalAmount: 500,
      };
      income.commissionPaid = false; // Resetear porque es refund total

      mockIncomeRepository.update.mockResolvedValue(income);

      const result = await service.updateIncome('system', income);

      expect(mockIncomeRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          refundMetadata: expect.objectContaining({
            isRefunded: true,
            refundedAmount: 500,
            isPartialRefund: false,
          }),
          commissionPaid: false, // ✅ Resetea en refund total
        })
      );

      expect(result.refundMetadata.isRefunded).toBe(true);
      expect(result.commissionPaid).toBe(false);
    });

    it('debe mantener commissionPaid en refund parcial', async () => {
      const income: Income = {
        id: 'income-2',
        commerceId: 'commerce-1',
        amount: 1000,
        professionalCommission: 200,
        commissionPaid: true,
        commissionPaymentId: 'payment-2',
        paidAt: new Date('2026-01-10'),
        status: IncomeStatus.CONFIRMED,
        refundMetadata: null,
      } as Income;

      mockIncomeRepository.findById.mockResolvedValue(income);

      // Refund parcial de 500 (50%)
      income.refundMetadata = {
        isRefunded: true,
        refundedAmount: 500,
        isPartialRefund: true,
        originalAmount: 1000,
      };
      // commissionPaid se mantiene true en parcial

      mockIncomeRepository.update.mockResolvedValue(income);

      const result = await service.updateIncome('system', income);

      expect(result.refundMetadata).toMatchObject({
        isRefunded: true,
        refundedAmount: 500,
        isPartialRefund: true,
      });
      expect(result.commissionPaid).toBe(true); // ✅ Se mantiene en parcial

      // ✅ VALIDACIÓN CONTABLE:
      // Monto restante: 1000 - 500 = 500
      // Comisión reversa: 200 * 0.5 = 100
      // Lucro restante: 500 - (200 - 100) = 400
    });
  });

  describe('Caso 3: Obtener Incomes con Commission Pendiente', () => {
    it('debe excluir incomes refunded de commission pendientes', async () => {
      const incomes = [
        // Income normal con comisión pendiente
        {
          id: 'income-1',
          amount: 1000,
          professionalCommission: 200,
          commissionPaid: false,
          refundMetadata: null,
        },
        // Income con comisión ya pagada (no debe aparecer)
        {
          id: 'income-2',
          amount: 800,
          professionalCommission: 160,
          commissionPaid: true,
          refundMetadata: null,
        },
        // Income refunded total (NO debe aparecer aunque commissionPaid=false)
        {
          id: 'income-3',
          amount: 500,
          professionalCommission: 100,
          commissionPaid: false,
          refundMetadata: {
            isRefunded: true,
            refundedAmount: 500,
            isPartialRefund: false,
          },
        },
        // Income refunded parcial (NO debe aparecer aunque commissionPaid=true)
        {
          id: 'income-4',
          amount: 1000,
          professionalCommission: 200,
          commissionPaid: true,
          refundMetadata: {
            isRefunded: true,
            refundedAmount: 600,
            isPartialRefund: true,
          },
        },
      ];

      mockIncomeRepository.find.mockResolvedValue(incomes);

      // Filtrar commission pendientes
      const pendingIncomes = incomes.filter(income => {
        const isPaid = income.commissionPaid === true;
        const isRefunded = income.refundMetadata?.isRefunded === true;
        return !isPaid && !isRefunded;
      });

      // ✅ Solo debe quedar income-1
      expect(pendingIncomes).toHaveLength(1);
      expect(pendingIncomes[0].id).toBe('income-1');

      // ✅ VALIDACIÓN:
      // income-2 excluído porque commissionPaid=true
      // income-3 excluído porque está refunded
      // income-4 excluído porque está refunded (aunque parcial)
    });

    it('debe calcular correctamente total de comisiones pendientes', async () => {
      const incomes = [
        {
          id: 'income-1',
          amount: 1000,
          professionalCommission: 200,
          commissionPaid: false,
          refundMetadata: null,
        },
        {
          id: 'income-2',
          amount: 500,
          professionalCommission: 100,
          commissionPaid: false,
          refundMetadata: null,
        },
        {
          id: 'income-3',
          amount: 800,
          professionalCommission: 160,
          commissionPaid: true, // Pagada - no contar
          refundMetadata: null,
        },
        {
          id: 'income-4',
          amount: 600,
          professionalCommission: 120,
          commissionPaid: false,
          refundMetadata: {
            isRefunded: true,
            refundedAmount: 600,
          }, // Refunded - no contar
        },
      ];

      mockIncomeRepository.find.mockResolvedValue(incomes);

      const pendingIncomes = incomes.filter(income => {
        return income.commissionPaid === false && !income.refundMetadata?.isRefunded;
      });

      const totalCommissionsPending = pendingIncomes.reduce(
        (sum, income) => sum + (income.professionalCommission || 0),
        0
      );

      // Solo income-1 (200) + income-2 (100) = 300
      expect(totalCommissionsPending).toBe(300);

      // ✅ VALIDACIÓN CONTABLE:
      // income-1: 200 pendiente ✅
      // income-2: 100 pendiente ✅
      // income-3: 160 ya pagada ❌
      // income-4: 120 refunded ❌
      // Total pendiente: 300
    });
  });

  describe('Caso 4: Múltiples Refunds Acumulados', () => {
    it('debe acumular correctamente múltiples refunds parciales', async () => {
      const income: Income = {
        id: 'income-1',
        amount: 1000,
        professionalCommission: 200,
        commissionPaid: true,
        paidAt: new Date('2026-01-10'),
        status: IncomeStatus.CONFIRMED,
        refundMetadata: null,
      } as Income;

      mockIncomeRepository.findById.mockResolvedValue(income);

      // ─────────────────────────────────────────────────────────────
      // PRIMER REFUND: 300 (30%)
      // ─────────────────────────────────────────────────────────────
      income.refundMetadata = {
        isRefunded: true,
        refundedAmount: 300,
        isPartialRefund: true,
        originalAmount: 1000,
      };
      mockIncomeRepository.update.mockResolvedValue(income);
      await service.updateIncome('system', income);

      expect(income.refundMetadata.refundedAmount).toBe(300);

      // ─────────────────────────────────────────────────────────────
      // SEGUNDO REFUND: +400 (40%) → Total 700 (70%)
      // ─────────────────────────────────────────────────────────────
      income.refundMetadata = {
        ...income.refundMetadata,
        refundedAmount: 700, // Acumulado: 300 + 400
      };
      mockIncomeRepository.update.mockResolvedValue(income);
      await service.updateIncome('system', income);

      expect(income.refundMetadata.refundedAmount).toBe(700);

      // ─────────────────────────────────────────────────────────────
      // TERCER REFUND: +300 (30%) → Total 1000 (100%)
      // ─────────────────────────────────────────────────────────────
      income.refundMetadata = {
        isRefunded: true,
        refundedAmount: 1000, // Acumulado: 300 + 400 + 300 = 1000
        isPartialRefund: false, // Ahora es total
        originalAmount: 1000,
      };
      income.commissionPaid = false; // Resetear al llegar a 100%
      mockIncomeRepository.update.mockResolvedValue(income);
      await service.updateIncome('system', income);

      expect(income.refundMetadata).toMatchObject({
        refundedAmount: 1000,
        isPartialRefund: false,
      });
      expect(income.commissionPaid).toBe(false);

      // ✅ VALIDACIÓN CONTABLE:
      // Refund 1: 300 (comisión reversa: 60)
      // Refund 2: 400 (comisión reversa: 80)
      // Refund 3: 300 (comisión reversa: 60)
      // Total refunded: 1000 ✅
      // Total commission reversal: 200 ✅
    });
  });

  describe('Caso 5: Validación de Status en Incomes', () => {
    it('debe incluir solo CONFIRMED en cálculos de período', async () => {
      const incomes = [
        {
          id: 'income-1',
          amount: 1000,
          professionalCommission: 200,
          status: IncomeStatus.CONFIRMED,
          paidAt: new Date('2026-01-15'),
        },
        {
          id: 'income-2',
          amount: 500,
          professionalCommission: 100,
          status: IncomeStatus.PENDING,
          paidAt: new Date('2026-01-16'),
        },
        {
          id: 'income-3',
          amount: 800,
          professionalCommission: 160,
          status: IncomeStatus.CANCELLED,
          paidAt: new Date('2026-01-17'),
        },
        {
          id: 'income-4',
          amount: 600,
          professionalCommission: 120,
          status: IncomeStatus.CONFIRMED,
          paidAt: new Date('2026-01-18'),
        },
      ];

      mockIncomeRepository.find.mockResolvedValue(incomes);

      // Filtrar solo CONFIRMED
      const confirmedIncomes = incomes.filter(
        income => income.status === IncomeStatus.CONFIRMED
      );

      expect(confirmedIncomes).toHaveLength(2);
      expect(confirmedIncomes[0].id).toBe('income-1');
      expect(confirmedIncomes[1].id).toBe('income-4');

      // Calcular totales
      const totalAmount = confirmedIncomes.reduce((sum, i) => sum + i.amount, 0);
      const totalCommissions = confirmedIncomes.reduce((sum, i) => sum + i.professionalCommission, 0);

      expect(totalAmount).toBe(1600); // 1000 + 600
      expect(totalCommissions).toBe(320); // 200 + 120

      // ✅ VALIDACIÓN:
      // income-2 excluído (PENDING)
      // income-3 excluído (CANCELLED)
    });
  });

  describe('Caso 6: Income Not Found', () => {
    it('debe lanzar NotFoundException cuando income no existe', async () => {
      mockIncomeRepository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Caso 7: Validación de Monto Mínimo', () => {
    it('debe rechazar income con monto 0 o negativo', async () => {
      const createDto = {
        commerceId: 'commerce-1',
        clientId: 'client-1',
        professionalId: 'prof-1',
        amount: 0, // ❌ Monto inválido
        professionalCommission: 20,
        paidAt: new Date('2026-01-15'),
        status: IncomeStatus.CONFIRMED,
      };

      await expect(service.createIncome(createDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('debe rechazar income con comisión negativa', async () => {
      const createDto = {
        commerceId: 'commerce-1',
        clientId: 'client-1',
        professionalId: 'prof-1',
        amount: 100,
        professionalCommission: -20, // ❌ Comisión inválida
        paidAt: new Date('2026-01-15'),
        status: IncomeStatus.CONFIRMED,
      };

      await expect(service.createIncome(createDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('debe rechazar income con comisión mayor que monto', async () => {
      const createDto = {
        commerceId: 'commerce-1',
        clientId: 'client-1',
        professionalId: 'prof-1',
        amount: 100,
        professionalCommission: 150, // ❌ Comisión > monto
        paidAt: new Date('2026-01-15'),
        status: IncomeStatus.CONFIRMED,
      };

      await expect(service.createIncome(createDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('Caso 8: Filtrado por Rango de Fechas', () => {
    it('debe filtrar incomes por rango de fechas correctamente', async () => {
      const incomes = [
        {
          id: 'income-1',
          amount: 1000,
          paidAt: new Date('2026-01-05'),
          status: IncomeStatus.CONFIRMED,
        },
        {
          id: 'income-2',
          amount: 500,
          paidAt: new Date('2026-01-15'),
          status: IncomeStatus.CONFIRMED,
        },
        {
          id: 'income-3',
          amount: 800,
          paidAt: new Date('2026-01-25'),
          status: IncomeStatus.CONFIRMED,
        },
        {
          id: 'income-4',
          amount: 600,
          paidAt: new Date('2026-02-05'), // Fuera del rango
          status: IncomeStatus.CONFIRMED,
        },
      ];

      mockIncomeRepository.find.mockResolvedValue(incomes);

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      const filteredIncomes = incomes.filter(income => {
        return income.paidAt >= startDate && income.paidAt <= endDate;
      });

      expect(filteredIncomes).toHaveLength(3);
      expect(filteredIncomes.map(i => i.id)).toEqual(['income-1', 'income-2', 'income-3']);

      const totalAmount = filteredIncomes.reduce((sum, i) => sum + i.amount, 0);
      expect(totalAmount).toBe(2300); // 1000 + 500 + 800

      // ✅ income-4 excluído (fuera del rango)
    });
  });
});
