import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from 'nestjs-fireorm';
import { RefundService } from './refund.service';
import { Outcome } from '../../../outcome/model/outcome.entity';
import { Income } from '../../../income/model/income.entity';
import { IncomeService } from '../../../income/income.service';
import { OutcomeService } from '../../../outcome/outcome.service';
import { CreateRefundDto, RefundType, RefundReason } from '../dto/create-refund.dto';
import { OutcomeStatus } from '../../../outcome/model/outcome-status.enum';

describe('RefundService - Pruebas Financieras Exhaustivas Actualizadas', () => {
  let service: RefundService;
  let outcomeRepository: any;
  let incomeRepository: any;
  let incomeService: any;
  let outcomeService: any;

  const mockIncomeRepository = {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockOutcomeRepository = {
    findById: jest.fn(),
    whereEqualTo: jest.fn(() => ({
      find: jest.fn(),
    })),
    create: jest.fn(),
  };

  const mockIncomeService = {
    updateIncome: jest.fn(),
  };

  const mockOutcomeService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundService,
        {
          provide: getRepositoryToken(Outcome),
          useValue: mockOutcomeRepository,
        },
        {
          provide: getRepositoryToken(Income),
          useValue: mockIncomeRepository,
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

    service = module.get<RefundService>(RefundService);
    outcomeRepository = module.get(getRepositoryToken(Outcome));
    incomeRepository = module.get(getRepositoryToken(Income));
    incomeService = module.get<IncomeService>(IncomeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Caso 1: Reembolso Total sin Comisión Pagada', () => {
    it('debe crear refund de 100, NO crear commission-reversal, marcar income como refunded', async () => {
      // Arrange: Cliente pagó 100, comisión 20, comisión NO pagada aún
      const incomeId = 'income-123';
      const commerceId = 'commerce-456';
      const mockIncome: Income = {
        id: incomeId,
        commerceId: commerceId,
        amount: 100,
        totalAmount: 100,
        professionalCommission: 20,
        commissionPaid: false, // ❌ NO pagada
        commissionPaymentId: null,
        professionalId: 'prof-789',
        clientId: 'client-101',
        status: 'CONFIRMED' as any,
      } as Income;

      const createRefundDto: CreateRefundDto = {
        type: RefundType.PAYMENT_REFUND,
        originalTransactionId: incomeId,
        amount: 100, // Reembolso total
        reason: RefundReason.CUSTOMER_REQUEST,
        clientId: 'client-101',
      };

      mockIncomeRepository.findById.mockResolvedValue(mockIncome);
      mockOutcomeRepository.whereEqualTo.mockReturnValue({
        find: jest.fn().mockResolvedValue([]), // Sin refunds previos
      });
      mockOutcomeRepository.create.mockImplementation((outcome) =>
        Promise.resolve({ ...outcome, id: 'refund-outcome-123' })
      );
      mockIncomeService.updateIncome.mockResolvedValue(mockIncome);

      // Act
      const result = await service.processRefund(createRefundDto);

      // Assert - Verificar que se creó el refund outcome
      expect(mockOutcomeRepository.create).toHaveBeenCalledTimes(1); // Solo 1 outcome (refund)
      const refundOutcomeCall = mockOutcomeRepository.create.mock.calls[0][0];
      expect(refundOutcomeCall.type).toBe('payment-refund');
      expect(refundOutcomeCall.conceptType).toBe('payment-refund');
      expect(refundOutcomeCall.amount).toBe(100);
      expect(refundOutcomeCall.commerceId).toBe(commerceId);

      // Assert - Verificar que NO se creó commission-reversal (porque no estaba pagada)
      expect(mockOutcomeRepository.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'commission-reversal' })
      );

      // Assert - Verificar que income se marcó como refunded
      expect(mockIncomeService.updateIncome).toHaveBeenCalledWith(
        'system-refund',
        expect.objectContaining({
          commissionPaid: false,
          refundMetadata: expect.objectContaining({
            isRefunded: true,
            refundedAmount: 100,
            isPartialRefund: false,
            originalAmount: 100,
          }),
        })
      );

      // Assert - Resultado exitoso
      expect(result.success).toBe(true);
      expect(result.refundId).toBe('refund-outcome-123');

      // ✅ VALIDACIÓN CONTABLE:
      // Lucro antes: 100 - 20 = 80
      // Después de refund: -100 (refund) = -100
      // Lucro neto: 80 - 100 = -20
      // ❌ Pérdida de 20 porque comisión no estaba pagada (profesional se quedó con ella)
    });
  });

  describe('Caso 2: Reembolso Total con Comisión Pagada', () => {
    it('debe crear refund de 100, crear commission-reversal de 20, cuadrar contabilidad perfectamente', async () => {
      // Arrange: Cliente pagó 100, comisión 20, comisión YA pagada
      const incomeId = 'income-123';
      const commerceId = 'commerce-456';
      const mockIncome: Income = {
        id: incomeId,
        commerceId: commerceId,
        amount: 100,
        totalAmount: 100,
        professionalCommission: 20,
        commissionPaid: true, // ✅ YA pagada
        commissionPaymentId: 'payment-999',
        professionalId: 'prof-789',
        clientId: 'client-101',
        status: 'CONFIRMED' as any,
      } as Income;

      const createRefundDto: CreateRefundDto = {
        type: RefundType.PAYMENT_REFUND,
        originalTransactionId: incomeId,
        amount: 100,
        reason: RefundReason.CUSTOMER_REQUEST,
        clientId: 'client-101',
      };

      mockIncomeRepository.findById.mockResolvedValue(mockIncome);
      mockOutcomeRepository.whereEqualTo.mockReturnValue({
        find: jest.fn().mockResolvedValue([]),
      });
      mockOutcomeRepository.create.mockImplementation((outcome) =>
        Promise.resolve({ ...outcome, id: `outcome-${outcome.type}` })
      );
      mockIncomeService.updateIncome.mockResolvedValue(mockIncome);

      // Act
      const result = await service.processRefund(createRefundDto);

      // Assert - Verificar que se crearon 2 outcomes
      expect(mockOutcomeRepository.create).toHaveBeenCalledTimes(2);

      // Assert - Verificar refund outcome
      const calls = mockOutcomeRepository.create.mock.calls;
      const refundCall = calls.find(call => call[0].type === 'payment-refund');
      expect(refundCall[0]).toMatchObject({
        type: 'payment-refund',
        conceptType: 'payment-refund',
        amount: 100,
        commerceId: commerceId,
      });

      // Assert - Verificar commission-reversal outcome
      const reversalCall = calls.find(call => call[0].type === 'commission-reversal');
      expect(reversalCall[0]).toMatchObject({
        type: 'commission-reversal',
        conceptType: 'commission-reversal',
        amount: 20, // ✅ Comisión completa porque es reembolso total
        commerceId: commerceId,
        beneficiary: 'prof-789',
        auxiliaryId: incomeId,
      });

      // Assert - Verificar que income se marcó correctamente
      expect(mockIncomeService.updateIncome).toHaveBeenCalledWith(
        'system-refund',
        expect.objectContaining({
          commissionPaid: false, // Resetea porque es reembolso total
          commissionPaymentId: null,
          refundMetadata: expect.objectContaining({
            isRefunded: true,
            refundedAmount: 100,
            isPartialRefund: false,
          }),
        })
      );

      // ✅ VALIDACIÓN CONTABLE:
      // Lucro antes: 100 - 20 = 80
      // Después de refund: -100 (refund) + 20 (commission-reversal) = -80
      // Lucro neto: 80 - 80 = 0 ✅ CUADRA PERFECTO
    });
  });

  describe('Caso 3: Reembolso Parcial (50%) con Comisión Pagada', () => {
    it('debe crear refund de 50, commission-reversal proporcional de 10, calcular correctamente', async () => {
      // Arrange: Cliente pagó 100, comisión 20, reembolsar 50
      const incomeId = 'income-123';
      const mockIncome: Income = {
        id: incomeId,
        commerceId: 'commerce-456',
        amount: 100,
        totalAmount: 100,
        professionalCommission: 20,
        commissionPaid: true,
        commissionPaymentId: 'payment-999',
        professionalId: 'prof-789',
        clientId: 'client-101',
        status: 'CONFIRMED' as any,
      } as Income;

      const createRefundDto: CreateRefundDto = {
        type: RefundType.PAYMENT_REFUND,
        originalTransactionId: incomeId,
        amount: 50, // Reembolso parcial (50%)
        reason: RefundReason.SERVICE_ISSUE,
        clientId: 'client-101',
      };

      mockIncomeRepository.findById.mockResolvedValue(mockIncome);
      mockOutcomeRepository.whereEqualTo.mockReturnValue({
        find: jest.fn().mockResolvedValue([]),
      });
      mockOutcomeRepository.create.mockImplementation((outcome) =>
        Promise.resolve({ ...outcome, id: `outcome-${Math.random()}` })
      );
      mockIncomeService.updateIncome.mockResolvedValue(mockIncome);

      // Act
      const result = await service.processRefund(createRefundDto);

      // Assert - 2 outcomes creados
      expect(mockOutcomeRepository.create).toHaveBeenCalledTimes(2);

      // Assert - Refund de 50
      const calls = mockOutcomeRepository.create.mock.calls;
      const refundCall = calls.find(call => call[0].type === 'payment-refund');
      expect(refundCall[0].amount).toBe(50);

      // Assert - Commission-reversal proporcional: 50/100 * 20 = 10
      const reversalCall = calls.find(call => call[0].type === 'commission-reversal');
      expect(reversalCall[0].amount).toBe(10); // ✅ 50% de la comisión

      // Assert - Income marcado como parcialmente refunded
      expect(mockIncomeService.updateIncome).toHaveBeenCalledWith(
        'system-refund',
        expect.objectContaining({
          commissionPaid: true, // ❌ Sigue true porque es parcial
          refundMetadata: expect.objectContaining({
            isRefunded: true,
            refundedAmount: 50,
            isPartialRefund: true, // ✅ Parcial
            originalAmount: 100,
          }),
        })
      );

      // ✅ VALIDACIÓN CONTABLE:
      // Lucro antes: 100 - 20 = 80
      // Después de refund: -50 (refund) + 10 (commission-reversal) = -40
      // Lucro neto: 80 - 40 = 40 ✅ Mantiene 50% del lucro
    });
  });

  describe('Caso 4: Múltiples Reembolsos Parciales', () => {
    it('debe acumular refunds correctamente: 30 + 40 + 30 = 100', async () => {
      const incomeId = 'income-123';
      const mockIncome: Income = {
        id: incomeId,
        commerceId: 'commerce-456',
        amount: 100,
        totalAmount: 100,
        professionalCommission: 20,
        commissionPaid: true,
        professionalId: 'prof-789',
        clientId: 'client-101',
        status: 'CONFIRMED' as any,
      } as Income;

      // Refund 1: 30
      const refund1: CreateRefundDto = {
        type: RefundType.PAYMENT_REFUND,
        originalTransactionId: incomeId,
        amount: 30,
        reason: RefundReason.CUSTOMER_REQUEST,
        clientId: 'client-101',
      };

      mockIncomeRepository.findById.mockResolvedValue(mockIncome);
      mockOutcomeRepository.whereEqualTo.mockReturnValue({
        find: jest.fn().mockResolvedValue([]), // Sin refunds previos
      });
      mockOutcomeRepository.create.mockImplementation((outcome) =>
        Promise.resolve({ ...outcome, id: `outcome-${Math.random()}` })
      );
      mockIncomeService.updateIncome.mockResolvedValue(mockIncome);

      // Act - Primera refund
      await service.processRefund(refund1);

      // Assert - Primer refund: 30, commission-reversal: 6 (30%)
      let calls = mockOutcomeRepository.create.mock.calls;
      let refundCall = calls.find(call => call[0].type === 'payment-refund');
      let reversalCall = calls.find(call => call[0].type === 'commission-reversal');
      expect(refundCall[0].amount).toBe(30);
      expect(reversalCall[0].amount).toBe(6); // 30% de 20

      // Assert - Metadata con refundedAmount: 30
      expect(mockIncomeService.updateIncome).toHaveBeenLastCalledWith(
        'system-refund',
        expect.objectContaining({
          refundMetadata: expect.objectContaining({
            refundedAmount: 30,
            isPartialRefund: true,
          }),
        })
      );

      // Refund 2: 40 (acumulado: 70)
      jest.clearAllMocks();
      const previousRefund1 = {
        conceptType: 'payment-refund',
        amount: 30,
        auxiliaryId: incomeId
      };
      mockOutcomeRepository.whereEqualTo.mockReturnValue({
        find: jest.fn().mockResolvedValue([previousRefund1]),
      });

      const refund2: CreateRefundDto = {
        ...refund1,
        amount: 40,
      };

      // Act - Segunda refund
      await service.processRefund(refund2);

      // Assert - Segundo refund: 40, commission-reversal: 8 (40%)
      calls = mockOutcomeRepository.create.mock.calls;
      refundCall = calls.find(call => call[0].type === 'payment-refund');
      reversalCall = calls.find(call => call[0].type === 'commission-reversal');
      expect(refundCall[0].amount).toBe(40);
      expect(reversalCall[0].amount).toBe(8); // 40% de 20

      // Assert - Metadata acumulada: 30 + 40 = 70
      expect(mockIncomeService.updateIncome).toHaveBeenLastCalledWith(
        'system-refund',
        expect.objectContaining({
          refundMetadata: expect.objectContaining({
            refundedAmount: 70, // ✅ Acumulado
            isPartialRefund: true,
          }),
        })
      );

      // Refund 3: 30 (acumulado: 100 = total)
      jest.clearAllMocks();
      const previousRefunds = [
        { conceptType: 'payment-refund', amount: 30, auxiliaryId: incomeId },
        { conceptType: 'payment-refund', amount: 40, auxiliaryId: incomeId },
      ];
      mockOutcomeRepository.whereEqualTo.mockReturnValue({
        find: jest.fn().mockResolvedValue(previousRefunds),
      });

      const refund3: CreateRefundDto = {
        ...refund1,
        amount: 30,
      };

      // Act - Tercera refund (completa el 100%)
      await service.processRefund(refund3);

      // Assert - Tercer refund: 30, commission-reversal: 6 (30%)
      calls = mockOutcomeRepository.create.mock.calls;
      refundCall = calls.find(call => call[0].type === 'payment-refund');
      reversalCall = calls.find(call => call[0].type === 'commission-reversal');
      expect(refundCall[0].amount).toBe(30);
      expect(reversalCall[0].amount).toBe(6); // 30% de 20

      // Assert - Metadata: reembolso total acumulado
      expect(mockIncomeService.updateIncome).toHaveBeenLastCalledWith(
        'system-refund',
        expect.objectContaining({
          commissionPaid: false, // ✅ Ahora false porque totalRefunded >= originalAmount
          refundMetadata: expect.objectContaining({
            refundedAmount: 100, // ✅ Total
            isPartialRefund: false, // ✅ Ya no es parcial
          }),
        })
      );

      // ✅ VALIDACIÓN CONTABLE FINAL:
      // Total refunds: 30 + 40 + 30 = 100
      // Total commission-reversals: 6 + 8 + 6 = 20
      // Lucro neto: 100 - 20 - 100 + 20 = 0 ✅ CUADRA PERFECTO
    });
  });

  describe('Caso 5: Validaciones de Límites', () => {
    it('debe rechazar refund mayor al monto original', async () => {
      const mockIncome: Income = {
        id: 'income-123',
        commerceId: 'commerce-456',
        amount: 100,
        totalAmount: 100,
        professionalCommission: 20,
        commissionPaid: false,
        status: 'CONFIRMED' as any,
      } as Income;

      const createRefundDto: CreateRefundDto = {
        type: RefundType.PAYMENT_REFUND,
        originalTransactionId: 'income-123',
        amount: 150, // ❌ Mayor que 100
        reason: RefundReason.CUSTOMER_REQUEST,
        clientId: 'client-101',
      };

      mockIncomeRepository.findById.mockResolvedValue(mockIncome);
      mockOutcomeRepository.whereEqualTo.mockReturnValue({
        find: jest.fn().mockResolvedValue([]),
      });

      // Act & Assert
      await expect(service.processRefund(createRefundDto)).rejects.toThrow(BadRequestException);
      await expect(service.processRefund(createRefundDto)).rejects.toThrow(
        'El monto del reembolso (150) no puede ser mayor al monto original (100)'
      );
    });

    it('debe rechazar refund que exceda el monto con refunds previos', async () => {
      const mockIncome: Income = {
        id: 'income-123',
        commerceId: 'commerce-456',
        amount: 100,
        totalAmount: 100,
        professionalCommission: 20,
        commissionPaid: false,
        status: 'CONFIRMED' as any,
      } as Income;

      const createRefundDto: CreateRefundDto = {
        type: RefundType.PAYMENT_REFUND,
        originalTransactionId: 'income-123',
        amount: 60, // Con refund previo de 50 = 110 total
        reason: RefundReason.CUSTOMER_REQUEST,
        clientId: 'client-101',
      };

      mockIncomeRepository.findById.mockResolvedValue(mockIncome);
      mockOutcomeRepository.whereEqualTo.mockReturnValue({
        find: jest.fn().mockResolvedValue([
          { conceptType: 'payment-refund', amount: 50 },
        ]),
      });

      // Act & Assert
      await expect(service.processRefund(createRefundDto)).rejects.toThrow(BadRequestException);
      await expect(service.processRefund(createRefundDto)).rejects.toThrow(
        'El monto total de reembolsos (110) no puede exceder el monto original (100)'
      );
    });
  });

  describe('Caso 6: Income No Encontrado', () => {
    it('debe lanzar NotFoundException si income no existe', async () => {
      const createRefundDto: CreateRefundDto = {
        type: RefundType.PAYMENT_REFUND,
        originalTransactionId: 'income-inexistente',
        amount: 50,
        reason: RefundReason.CUSTOMER_REQUEST,
        clientId: 'client-101',
      };

      mockIncomeRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.processRefund(createRefundDto)).rejects.toThrow(NotFoundException);
      await expect(service.processRefund(createRefundDto)).rejects.toThrow(
        'Transacción original no encontrada'
      );
    });
  });
});
