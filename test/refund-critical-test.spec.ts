import { RefundService } from '../src/modules/financial/services/refund.service';
import { CreateRefundDto, RefundReason } from '../src/modules/financial/dto/create-refund.dto';
import { Income } from '../src/income/model/income.entity';
import { Outcome } from '../src/outcome/model/outcome.entity';
import { IncomeStatus } from '../src/income/model/income-status.enum';
import { OutcomeStatus } from '../src/outcome/model/outcome-status.enum';
import { IncomeType } from '../src/income/model/income-type.enum';
import { PaymentMethod } from '../src/payment/model/payment-method.enum';

describe('🔧 REFUND SERVICE - TEST DE INTEGRACIÓN CRÍTICO', () => {
  let refundService: RefundService;
  let mockIncomeRepository: any;
  let mockOutcomeRepository: any;
  let mockIncomeService: any;
  let mockOutcomeService: any;

  beforeEach(() => {
    // Mock repositories
    mockIncomeRepository = {
      findById: jest.fn(),
      update: jest.fn(),
      create: jest.fn()
    };

    mockOutcomeRepository = {
      create: jest.fn(),
      whereEqualTo: jest.fn().mockReturnThis(),
      find: jest.fn()
    };

    mockIncomeService = {};
    mockOutcomeService = {};

    // Create service with mocked dependencies
    refundService = new RefundService(
      mockOutcomeRepository,
      mockIncomeRepository,
      mockIncomeService,
      mockOutcomeService
    );
  });

  describe('✅ TEST CRÍTICO: Refund debe actualizar Income con metadata', () => {

    it('DEBE crear outcome Y actualizar income original con refundMetadata', async () => {
      // 1. Setup - Income original
      const originalIncome: Income = {
        id: 'INCOME_123',
        commerceId: 'COMMERCE_456',
        clientId: 'CLIENT_789',
        amount: 200,
        totalAmount: 200,
        professionalId: 'PROF_101',
        professionalName: 'Dr. Test',
        professionalCommission: 40,
        commissionPaid: false,
        status: IncomeStatus.CONFIRMED,
        type: IncomeType.UNIQUE,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        createdAt: new Date(),
        // ... otros campos requeridos
      } as Income;

      // 2. Setup - Mocks
      // Mock findOriginalTransaction (método privado simulado)
      const mockFindOriginalTransaction = jest.spyOn(refundService as any, 'findOriginalTransaction')
        .mockResolvedValue({
          type: 'income',
          data: originalIncome
        });

      // Mock validateRefundAmount (no hacer nada)
      const mockValidateRefundAmount = jest.spyOn(refundService as any, 'validateRefundAmount')
        .mockResolvedValue(true);

      // Mock outcome creation
      const mockCreatedOutcome = {
        id: 'REFUND_OUTCOME_789',
        amount: 100,
        conceptType: 'cancellation-refund',
        auxiliaryId: 'INCOME_123',
        status: OutcomeStatus.CONFIRMED,
        createdAt: new Date(),
        code: 'REF-12345',
        description: 'Refund test'
      } as Outcome;

      mockOutcomeRepository.create.mockResolvedValue(mockCreatedOutcome);

      // Mock existing refunds (ninguno previo)
      mockOutcomeRepository.find.mockResolvedValue([mockCreatedOutcome]);

      // Mock income update
      mockIncomeRepository.update.mockResolvedValue(originalIncome);

      // Mock publish event (opcional)
      const mockPublish = jest.fn();
      (refundService as any).publish = mockPublish;

      // 3. Ejecutar refund
      const refundDto: CreateRefundDto = {
        originalTransactionId: 'INCOME_123',
        amount: 100,
        type: 'cancellation-refund',
        reason: RefundReason.SERVICE_ISSUE,
        clientId: 'CLIENT_789',
        professionalId: 'PROF_101'
      };

      const result = await refundService.processRefund(refundDto);

      // 4. VALIDACIONES CRÍTICAS
      expect(result.success).toBe(true);
      expect(result.refundId).toBe('REFUND_OUTCOME_789');

      // 5. VALIDAR: Outcome creado correctamente
      expect(mockOutcomeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          commerceId: 'COMMERCE_456',
          amount: 100,
          conceptType: 'cancellation-refund',
          auxiliaryId: 'INCOME_123',
          status: OutcomeStatus.CONFIRMED,
          type: 'payment-refund'
        })
      );

      // 6. VALIDAR CRÍTICO: Income actualizado con metadata
      expect(mockIncomeRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          refundMetadata: expect.objectContaining({
            isRefunded: false,        // Refund parcial
            totalRefunded: 100,
            refundCount: 1,
            originalAmount: 200,
            refundHistory: expect.arrayContaining([
              expect.objectContaining({
                refundId: 'REFUND_OUTCOME_789',
                amount: 100,
                type: 'cancellation-refund'
              })
            ]),
            lastRefundId: 'REFUND_OUTCOME_789'
          })
        })
      );

      // 7. VALIDAR: Métodos llamados correctamente
      expect(mockFindOriginalTransaction).toHaveBeenCalledWith('INCOME_123');
      expect(mockValidateRefundAmount).toHaveBeenCalled();
    });

    it('DEBE marcar income como completamente reembolsado en refund total', async () => {
      // Setup similar pero con refund total
      const originalIncome: Income = {
        id: 'INCOME_456',
        commerceId: 'COMMERCE_789',
        amount: 150,
        totalAmount: 150
      } as Income;

      jest.spyOn(refundService as any, 'findOriginalTransaction')
        .mockResolvedValue({ type: 'income', data: originalIncome });

      jest.spyOn(refundService as any, 'validateRefundAmount')
        .mockResolvedValue(true);

      const mockCreatedOutcome = {
        id: 'REFUND_TOTAL_123',
        amount: 150
      } as Outcome;

      mockOutcomeRepository.create.mockResolvedValue(mockCreatedOutcome);
      mockOutcomeRepository.find.mockResolvedValue([mockCreatedOutcome]);
      mockIncomeRepository.update.mockResolvedValue(originalIncome);

      // Refund total
      const refundDto: CreateRefundDto = {
        originalTransactionId: 'INCOME_456',
        amount: 150, // Total
        type: 'cancellation-refund',
        reason: RefundReason.CUSTOMER_REQUEST,
        clientId: 'CLIENT_999',
        professionalId: 'PROF_999'
      };

      await refundService.processRefund(refundDto);

      // VALIDACIÓN CRÍTICA: isRefunded = true
      expect(mockIncomeRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          refundMetadata: expect.objectContaining({
            isRefunded: true,         // Completamente reembolsado
            totalRefunded: 150,
            originalAmount: 150
          })
        })
      );
    });

    it('DEBE acumular múltiples refunds correctamente', async () => {
      const originalIncome: Income = {
        id: 'INCOME_MULTI',
        amount: 300,
        totalAmount: 300
      } as Income;

      jest.spyOn(refundService as any, 'findOriginalTransaction')
        .mockResolvedValue({ type: 'income', data: originalIncome });

      jest.spyOn(refundService as any, 'validateRefundAmount')
        .mockResolvedValue(true);

      // Mock: Ya existe un refund previo de 100
      const existingRefund = {
        id: 'REFUND_PREV',
        amount: 100,
        conceptType: 'cancellation-refund'
      } as Outcome;

      const newRefund = {
        id: 'REFUND_NEW',
        amount: 80,
        conceptType: 'cancellation-refund'
      } as Outcome;

      mockOutcomeRepository.create.mockResolvedValue(newRefund);
      // Simular que find() retorna ambos refunds
      mockOutcomeRepository.find.mockResolvedValue([existingRefund, newRefund]);
      mockIncomeRepository.update.mockResolvedValue(originalIncome);

      const refundDto: CreateRefundDto = {
        originalTransactionId: 'INCOME_MULTI',
        amount: 80,
        type: 'cancellation-refund',
        reason: RefundReason.SERVICE_ISSUE,
        clientId: 'CLIENT_MULTI',
        professionalId: 'PROF_MULTI'
      };

      await refundService.processRefund(refundDto);

      // VALIDACIÓN: Acumulación correcta
      expect(mockIncomeRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          refundMetadata: expect.objectContaining({
            totalRefunded: 180,    // 100 + 80
            refundCount: 2,
            isRefunded: false,     // 180 < 300
            refundHistory: expect.arrayContaining([
              expect.objectContaining({ amount: 100 }),
              expect.objectContaining({ amount: 80 })
            ])
          })
        })
      );
    });

  });

  describe('✅ VALIDACIONES DE FALLO', () => {

    it('DEBE fallar si income original no existe', async () => {
      jest.spyOn(refundService as any, 'findOriginalTransaction')
        .mockResolvedValue(null);

      const refundDto: CreateRefundDto = {
        originalTransactionId: 'NONEXISTENT',
        amount: 100,
        type: 'cancellation-refund',
        reason: RefundReason.OTHER,
        clientId: 'CLIENT_X',
        professionalId: 'PROF_X'
      };

      await expect(refundService.processRefund(refundDto))
        .rejects
        .toThrow(/no encontrada/i);
    });

  });

});