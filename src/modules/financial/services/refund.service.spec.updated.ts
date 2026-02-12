import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from 'nestjs-fireorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
  let eventEmitter: any;

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

  const mockEventEmitter = {
    emit: jest.fn(),
  };

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
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<RefundService>(RefundService);
    outcomeRepository = module.get(getRepositoryToken(Outcome));
    incomeRepository = module.get(getRepositoryToken(Income));
    incomeService = module.get<IncomeService>(IncomeService);
    outcomeService = module.get<OutcomeService>(OutcomeService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRefund - Funcionalidad Mejorada', () => {
    const mockIncome = {
      id: 'income-123',
      amount: 1000,
      paymentMethodFee: 50,
      deductionReceived: 100,
      professionalCommission: 200,
      refundMetadata: {},
    };

    const validCreateRefundDto: CreateRefundDto = {
      entityType: 'income',
      refundType: RefundType.FULL_REFUND,
      refundReason: RefundReason.CUSTOMER_REQUEST,
    };

    beforeEach(() => {
      mockIncomeRepository.findById.mockResolvedValue(mockIncome);
      mockIncomeService.updateIncome.mockResolvedValue(undefined);
      mockOutcomeRepository.whereEqualTo.mockReturnValue({
        find: jest.fn().mockResolvedValue([]),
      });
      mockOutcomeRepository.create.mockResolvedValue({
        id: 'refund-123',
        type: 'REFUND',
      });
    });

    it('DEBE crear refund completo e income metadata actualizado', async () => {
      const result = await service.createRefund('income-123', validCreateRefundDto);

      expect(result.refund.amount).toBe(1000);
      expect(result.refund.type).toBe('REFUND');
      expect(result.refunds).toHaveLength(1);
      
      // Verificar que income metadata se actualiza
      expect(mockIncomeService.updateIncome).toHaveBeenCalledWith('income-123', {
        refundMetadata: {
          hasFullRefund: true,
          fullRefundId: 'refund-123',
          fullRefundDate: expect.any(Date),
          totalRefundAmount: 1000,
        },
      });

      // Verificar que se emite evento para PostgreSQL sync
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'income.updated',
        expect.objectContaining({
          incomeId: 'income-123',
          changes: {
            refundMetadata: {
              hasFullRefund: true,
              fullRefundId: 'refund-123',
              fullRefundDate: expect.any(Date),
              totalRefundAmount: 1000,
            },
          },
        }),
      );
    });

    it('DEBE crear refund parcial con comisión reversal', async () => {
      const partialDto: CreateRefundDto = {
        ...validCreateRefundDto,
        refundType: RefundType.PARTIAL_REFUND,
        refundAmount: 300,
      };

      const result = await service.createRefund('income-123', partialDto);

      // Debe crear refund de 300
      expect(result.refund.amount).toBe(300);
      
      // Debe crear commission reversal de 60 (30% de 200)
      expect(result.commissionReversal.amount).toBe(60);
      expect(result.commissionReversal.type).toBe('COMMISSION_REVERSAL');

      // Verificar metadata de partial refund
      expect(mockIncomeService.updateIncome).toHaveBeenCalledWith('income-123', {
        refundMetadata: {
          hasPartialRefund: true,
          partialRefunds: [
            {
              id: 'refund-123',
              amount: 300,
              date: expect.any(Date),
            },
          ],
          totalRefundAmount: 300,
          commissionReversals: [
            {
              amount: 60,
              date: expect.any(Date),
            },
          ],
        },
      });
    });

    it('DEBE prevenir refund duplicado cuando ya existe full refund', async () => {
      mockIncomeRepository.findById.mockResolvedValue({
        ...mockIncome,
        refundMetadata: {
          hasFullRefund: true,
          fullRefundId: 'existing-refund',
        },
      });

      await expect(
        service.createRefund('income-123', validCreateRefundDto),
      ).rejects.toThrow('Ya existe un reembolso completo para este ingreso');
    });

    it('DEBE prevenir refund parcial excesivo', async () => {
      mockIncomeRepository.findById.mockResolvedValue({
        ...mockIncome,
        refundMetadata: {
          hasPartialRefund: true,
          partialRefunds: [{ amount: 800 }],
          totalRefundAmount: 800,
        },
      });

      const partialDto: CreateRefundDto = {
        ...validCreateRefundDto,
        refundType: RefundType.PARTIAL_REFUND,
        refundAmount: 300,
      };

      await expect(
        service.createRefund('income-123', partialDto),
      ).rejects.toThrow('El monto total de reembolsos parciales excedería el monto original');
    });

    it('DEBE manejar service refund con fee reduction', async () => {
      const serviceRefundDto: CreateRefundDto = {
        ...validCreateRefundDto,
        refundType: RefundType.SERVICE_REFUND,
        refundAmount: 100,
        feeReduction: 25,
      };

      const result = await service.createRefund('income-123', serviceRefundDto);

      expect(result.refund.amount).toBe(100);
      expect(result.refund.feeReduction).toBe(25);
      expect(result.refund.description).toContain('Reembolso por servicios');

      // Verificar metadata actualizada
      expect(mockIncomeService.updateIncome).toHaveBeenCalledWith('income-123', {
        refundMetadata: {
          hasPartialRefund: true,
          partialRefunds: [
            {
              id: 'refund-123',
              amount: 100,
              date: expect.any(Date),
              type: 'service-refund',
              feeReduction: 25,
            },
          ],
          totalRefundAmount: 100,
        },
      });
    });

    it('DEBE crear commission reversal para cancellation refund', async () => {
      const cancellationDto: CreateRefundDto = {
        ...validCreateRefundDto,
        refundType: RefundType.CANCELLATION_REFUND,
      };

      const result = await service.createRefund('income-123', cancellationDto);

      // Full refund + full commission reversal
      expect(result.refund.amount).toBe(1000);
      expect(result.commissionReversal.amount).toBe(200);
      expect(result.commissionReversal.type).toBe('COMMISSION_REVERSAL');

      // Metadata debe incluir commission reversal
      const updateCall = mockIncomeService.updateIncome.mock.calls[0][1];
      expect(updateCall.refundMetadata.commissionReversals).toHaveLength(1);
      expect(updateCall.refundMetadata.commissionReversals[0].amount).toBe(200);
    });
  });

  describe('Consistencia y Sincronización', () => {
    it('DEBE emitir eventos para sincronizar con PostgreSQL', async () => {
      const mockIncome = {
        id: 'income-456',
        amount: 500,
        professionalCommission: 100,
        refundMetadata: {},
      };

      mockIncomeRepository.findById.mockResolvedValue(mockIncome);
      mockIncomeService.updateIncome.mockResolvedValue(undefined);
      mockOutcomeRepository.whereEqualTo.mockReturnValue({
        find: jest.fn().mockResolvedValue([]),
      });
      mockOutcomeRepository.create.mockResolvedValue({
        id: 'refund-456',
        type: 'REFUND',
      });

      const dto: CreateRefundDto = {
        entityType: 'income',
        refundType: RefundType.FULL_REFUND,
        refundReason: RefundReason.TECHNICAL_ERROR,
      };

      await service.createRefund('income-456', dto);

      // Verificar evento emitido para PostgreSQL
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'income.updated',
        expect.objectContaining({
          incomeId: 'income-456',
          changes: expect.objectContaining({
            refundMetadata: expect.objectContaining({
              hasFullRefund: true,
              fullRefundId: 'refund-456',
            }),
          }),
        }),
      );
    });

    it('DEBE calcular correctamente commission reversal percentage', async () => {
      const mockIncome = {
        id: 'income-789',
        amount: 2000,
        professionalCommission: 400, // 20%
        refundMetadata: {},
      };

      mockIncomeRepository.findById.mockResolvedValue(mockIncome);
      mockIncomeService.updateIncome.mockResolvedValue(undefined);
      mockOutcomeRepository.whereEqualTo.mockReturnValue({
        find: jest.fn().mockResolvedValue([]),
      });
      mockOutcomeRepository.create.mockResolvedValue({
        id: 'refund-789',
        type: 'REFUND',
      });

      const partialDto: CreateRefundDto = {
        entityType: 'income',
        refundType: RefundType.PARTIAL_REFUND,
        refundAmount: 500, // 25% del monto original
        refundReason: RefundReason.CUSTOMER_REQUEST,
      };

      const result = await service.createRefund('income-789', partialDto);

      // Commission reversal debe ser 25% de 400 = 100
      expect(result.commissionReversal.amount).toBe(100);
      
      const updateCall = mockIncomeService.updateIncome.mock.calls[0][1];
      expect(updateCall.refundMetadata.commissionReversals[0].amount).toBe(100);
    });
  });

  describe('Casos Edge y Validaciones', () => {
    it('DEBE validar entity no encontrada', async () => {
      mockIncomeRepository.findById.mockResolvedValue(null);

      await expect(
        service.createRefund('non-existent', {
          entityType: 'income',
          refundType: RefundType.FULL_REFUND,
          refundReason: RefundReason.CUSTOMER_REQUEST,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('DEBE manejar income sin commission para partial refund', async () => {
      const incomeWithoutCommission = {
        id: 'income-no-commission',
        amount: 1000,
        professionalCommission: 0,
        refundMetadata: {},
      };

      mockIncomeRepository.findById.mockResolvedValue(incomeWithoutCommission);
      mockIncomeService.updateIncome.mockResolvedValue(undefined);
      mockOutcomeRepository.whereEqualTo.mockReturnValue({
        find: jest.fn().mockResolvedValue([]),
      });
      mockOutcomeRepository.create.mockResolvedValue({
        id: 'refund-no-commission',
        type: 'REFUND',
      });

      const partialDto: CreateRefundDto = {
        entityType: 'income',
        refundType: RefundType.PARTIAL_REFUND,
        refundAmount: 300,
        refundReason: RefundReason.CUSTOMER_REQUEST,
      };

      const result = await service.createRefund('income-no-commission', partialDto);

      expect(result.refund.amount).toBe(300);
      expect(result.commissionReversal).toBeNull();

      // Metadata no debe incluir commission reversals
      const updateCall = mockIncomeService.updateIncome.mock.calls[0][1];
      expect(updateCall.refundMetadata.commissionReversals).toBeUndefined();
    });

    it('DEBE validar refundAmount para partial refunds', async () => {
      const mockIncome = {
        id: 'income-validation',
        amount: 1000,
        refundMetadata: {},
      };

      mockIncomeRepository.findById.mockResolvedValue(mockIncome);

      const invalidDto: CreateRefundDto = {
        entityType: 'income',
        refundType: RefundType.PARTIAL_REFUND,
        refundReason: RefundReason.CUSTOMER_REQUEST,
        // Missing refundAmount for partial refund
      };

      await expect(
        service.createRefund('income-validation', invalidDto),
      ).rejects.toThrow('El monto de reembolso es requerido para reembolsos parciales');
    });

    it('DEBE manejar múltiples partial refunds acumulados', async () => {
      const incomeWithExistingRefunds = {
        id: 'income-multiple',
        amount: 1000,
        professionalCommission: 200,
        refundMetadata: {
          hasPartialRefund: true,
          partialRefunds: [
            { id: 'refund-1', amount: 300, date: new Date() },
            { id: 'refund-2', amount: 200, date: new Date() },
          ],
          totalRefundAmount: 500,
          commissionReversals: [
            { amount: 60, date: new Date() },
            { amount: 40, date: new Date() },
          ],
        },
      };

      mockIncomeRepository.findById.mockResolvedValue(incomeWithExistingRefunds);
      mockIncomeService.updateIncome.mockResolvedValue(undefined);
      mockOutcomeRepository.whereEqualTo.mockReturnValue({
        find: jest.fn().mockResolvedValue([]),
      });
      mockOutcomeRepository.create.mockResolvedValue({
        id: 'refund-3',
        type: 'REFUND',
      });

      const additionalPartialDto: CreateRefundDto = {
        entityType: 'income',
        refundType: RefundType.PARTIAL_REFUND,
        refundAmount: 200,
        refundReason: RefundReason.CUSTOMER_REQUEST,
      };

      const result = await service.createRefund('income-multiple', additionalPartialDto);

      expect(result.refund.amount).toBe(200);
      expect(result.commissionReversal.amount).toBe(40); // 20% de 200

      // Verificar que se acumula correctamente
      const updateCall = mockIncomeService.updateIncome.mock.calls[0][1];
      expect(updateCall.refundMetadata.partialRefunds).toHaveLength(3);
      expect(updateCall.refundMetadata.totalRefundAmount).toBe(700); // 500 + 200
      expect(updateCall.refundMetadata.commissionReversals).toHaveLength(3);
    });
  });

  describe('Payment Method Refunds', () => {
    it('DEBE manejar payment method refund con fee calculation', async () => {
      const mockIncome = {
        id: 'income-payment',
        amount: 1000,
        paymentMethodFee: 50,
        professionalCommission: 200,
        refundMetadata: {},
      };

      mockIncomeRepository.findById.mockResolvedValue(mockIncome);
      mockIncomeService.updateIncome.mockResolvedValue(undefined);
      mockOutcomeRepository.whereEqualTo.mockReturnValue({
        find: jest.fn().mockResolvedValue([]),
      });
      mockOutcomeRepository.create.mockResolvedValue({
        id: 'payment-refund',
        type: 'REFUND',
      });

      const paymentRefundDto: CreateRefundDto = {
        entityType: 'income',
        refundType: RefundType.PAYMENT_REFUND,
        refundReason: RefundReason.PAYMENT_ERROR,
      };

      const result = await service.createRefund('income-payment', paymentRefundDto);

      expect(result.refund.amount).toBe(1000);
      expect(result.refund.type).toBe('REFUND');
      expect(result.refund.description).toContain('Reembolso de pago');

      // Debe calcular fee reduction basado en payment method fee
      expect(result.refund.feeReduction).toBe(50);
    });
  });

  describe('Error Handling y Edge Cases', () => {
    it('DEBE manejar error en actualización de income metadata', async () => {
      const mockIncome = {
        id: 'income-error',
        amount: 1000,
        refundMetadata: {},
      };

      mockIncomeRepository.findById.mockResolvedValue(mockIncome);
      mockIncomeService.updateIncome.mockRejectedValue(new Error('Database error'));
      mockOutcomeRepository.whereEqualTo.mockReturnValue({
        find: jest.fn().mockResolvedValue([]),
      });

      const dto: CreateRefundDto = {
        entityType: 'income',
        refundType: RefundType.FULL_REFUND,
        refundReason: RefundReason.CUSTOMER_REQUEST,
      };

      await expect(
        service.createRefund('income-error', dto),
      ).rejects.toThrow('Database error');
    });

    it('DEBE manejar error en emisión de eventos', async () => {
      const mockIncome = {
        id: 'income-event-error',
        amount: 1000,
        refundMetadata: {},
      };

      mockIncomeRepository.findById.mockResolvedValue(mockIncome);
      mockIncomeService.updateIncome.mockResolvedValue(undefined);
      mockEventEmitter.emit.mockImplementation(() => {
        throw new Error('Event emission error');
      });
      mockOutcomeRepository.whereEqualTo.mockReturnValue({
        find: jest.fn().mockResolvedValue([]),
      });
      mockOutcomeRepository.create.mockResolvedValue({
        id: 'refund-event-error',
        type: 'REFUND',
      });

      const dto: CreateRefundDto = {
        entityType: 'income',
        refundType: RefundType.FULL_REFUND,
        refundReason: RefundReason.CUSTOMER_REQUEST,
      };

      // El error en emisión no debe afectar el refund principal
      const result = await service.createRefund('income-event-error', dto);
      expect(result.refund.id).toBe('refund-event-error');
    });
  });
});