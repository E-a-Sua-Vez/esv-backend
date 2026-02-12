import { Test, TestingModule } from '@nestjs/testing';
import { RefundService } from '../src/modules/financial/services/refund.service';
import { IncomeService } from '../src/income/income.service';
import { OutcomeService } from '../src/outcome/outcome.service';
import { CreateRefundDto, RefundReason } from '../src/modules/financial/dto/create-refund.dto';
import { Income } from '../src/income/model/income.entity';
import { Outcome } from '../src/outcome/model/outcome.entity';
import { IncomeStatus } from '../src/income/model/income-status.enum';
import { IncomeType } from '../src/income/model/income-type.enum';
import { OutcomeStatus } from '../src/outcome/model/outcome-status.enum';
import { PaymentMethod } from '../src/payment/model/payment-method.enum';

describe('🔧 REFUND SERVICE - INTEGRACIÓN COMPLETA END-TO-END', () => {
  let refundService: RefundService;
  let incomeService: IncomeService;
  let outcomeService: OutcomeService;
  
  let testIncome: Income;
  let testCommerceId = 'TEST_COMMERCE_123';
  let testClientId = 'TEST_CLIENT_456';
  let testProfessionalId = 'TEST_PROF_789';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundService,
        IncomeService,
        OutcomeService,
      ],
    }).compile();

    refundService = module.get<RefundService>(RefundService);
    incomeService = module.get<IncomeService>(IncomeService);
    outcomeService = module.get<OutcomeService>(OutcomeService);
  });

  beforeEach(async () => {
    // Crear income de prueba REAL
    testIncome = await incomeService.createIncome(
      testCommerceId,
      testClientId,
      '',  // bookingId
      '',  // attentionId
      '',  // packageId
      IncomeType.UNIQUE,
      200, // amount
      200, // totalAmount
      1,   // installmentNumber
      1,   // installments
      PaymentMethod.CREDIT_CARD,
      40,  // commission
      '',  // comment
      '',  // fiscalNote
      '',  // promotionalCode
      '',  // transactionId
      '',  // bankEntity
      0,   // discountAmount
      0,   // discountPercentage
      true, // paid
      '',   // typeName
      testProfessionalId,
      40,   // professionalCommission
      'Test Professional',  // professionalName
      'PERCENTAGE',  // professionalCommissionType
      20,   // professionalCommissionValue
      'Test commission',  // professionalCommissionNotes
      false, // commissionPaid
      '',    // commissionPaymentId
      [],    // servicesId
      []     // servicesDetails
    );
  });

  afterEach(async () => {
    // Limpiar datos de prueba
    if (testIncome?.id) {
      try {
        await incomeService.delete(testIncome.id);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  describe('✅ FLUJO COMPLETO: Refund + Update Income + Commission Reversal', () => {
    
    it('1.1 - REFUND PARCIAL debe crear outcome Y actualizar income con metadata', async () => {
      // 1. Preparar refund
      const refundDto: CreateRefundDto = {
        originalTransactionId: testIncome.id,
        amount: 100,  // Refund parcial de 200
        type: 'cancellation-refund',
        reason: RefundReason.SERVICE_ISSUE,
        clientId: testClientId,
        professionalId: testProfessionalId,
        description: 'Test refund parcial'
      };

      // 2. Ejecutar refund
      const result = await refundService.processRefund(refundDto);

      // 3. VALIDAR: Resultado del servicio
      expect(result.success).toBe(true);
      expect(result.refundId).toBeDefined();
      expect(result.transactionId).toBeDefined();

      // 4. VALIDAR: Outcome creado
      const refundOutcome = await outcomeService.findById(result.refundId);
      expect(refundOutcome).toBeDefined();
      expect(refundOutcome.amount).toBe(100);
      expect(refundOutcome.conceptType).toBe('cancellation-refund');
      expect(refundOutcome.auxiliaryId).toBe(testIncome.id);
      expect(refundOutcome.status).toBe(OutcomeStatus.CONFIRMED);

      // 5. VALIDAR: Income actualizado con metadata
      const updatedIncome = await incomeService.findById(testIncome.id);
      expect(updatedIncome.refundMetadata).toBeDefined();
      expect(updatedIncome.refundMetadata.totalRefunded).toBe(100);
      expect(updatedIncome.refundMetadata.refundCount).toBe(1);
      expect(updatedIncome.refundMetadata.isRefunded).toBe(false); // Parcial
      expect(updatedIncome.refundMetadata.originalAmount).toBe(200);
      expect(updatedIncome.refundMetadata.refundHistory).toHaveLength(1);
      expect(updatedIncome.refundMetadata.lastRefundId).toBe(result.refundId);
    });

    it('1.2 - REFUND TOTAL debe marcar income como completamente reembolsado', async () => {
      // 1. Refund total
      const refundDto: CreateRefundDto = {
        originalTransactionId: testIncome.id,
        amount: 200,  // Refund total
        type: 'cancellation-refund',
        reason: RefundReason.CUSTOMER_REQUEST,
        clientId: testClientId,
        professionalId: testProfessionalId
      };

      // 2. Ejecutar refund
      const result = await refundService.processRefund(refundDto);

      // 3. VALIDAR: Income marcado como completamente reembolsado
      const updatedIncome = await incomeService.findById(testIncome.id);
      expect(updatedIncome.refundMetadata.isRefunded).toBe(true);
      expect(updatedIncome.refundMetadata.totalRefunded).toBe(200);
      expect(updatedIncome.refundMetadata.totalRefunded).toBe(updatedIncome.refundMetadata.originalAmount);
    });

    it('1.3 - MÚLTIPLES REFUNDS deben acumular correctamente', async () => {
      // 1. Primer refund parcial
      const refund1: CreateRefundDto = {
        originalTransactionId: testIncome.id,
        amount: 80,
        type: 'cancellation-refund',
        reason: RefundReason.SERVICE_ISSUE,
        clientId: testClientId,
        professionalId: testProfessionalId
      };

      const result1 = await refundService.processRefund(refund1);

      // 2. Segundo refund parcial  
      const refund2: CreateRefundDto = {
        originalTransactionId: testIncome.id,
        amount: 120,
        type: 'cancellation-refund', 
        reason: RefundReason.TECHNICAL_ERROR,
        clientId: testClientId,
        professionalId: testProfessionalId
      };

      const result2 = await refundService.processRefund(refund2);

      // 3. VALIDAR: Acumulación correcta
      const updatedIncome = await incomeService.findById(testIncome.id);
      expect(updatedIncome.refundMetadata.totalRefunded).toBe(200); // 80 + 120
      expect(updatedIncome.refundMetadata.refundCount).toBe(2);
      expect(updatedIncome.refundMetadata.isRefunded).toBe(true); // Total refunded
      expect(updatedIncome.refundMetadata.refundHistory).toHaveLength(2);
      
      // Verificar historial
      const history = updatedIncome.refundMetadata.refundHistory;
      expect(history.some(r => r.refundId === result1.refundId && r.amount === 80)).toBe(true);
      expect(history.some(r => r.refundId === result2.refundId && r.amount === 120)).toBe(true);
    });

    it('1.4 - REFUND con COMISIÓN PAGADA debe revertir comisión proporcional', async () => {
      // 1. Marcar comisión como pagada
      testIncome.commissionPaid = true;
      testIncome.commissionPaymentId = 'PAYMENT_TEST_123';
      await incomeService.update(testIncome.id, testIncome);

      // 2. Refund parcial (50%)
      const refundDto: CreateRefundDto = {
        originalTransactionId: testIncome.id,
        amount: 100, // 50% de 200
        type: 'payment-refund',
        reason: RefundReason.SERVICE_ISSUE,
        clientId: testClientId,
        professionalId: testProfessionalId
      };

      // 3. Ejecutar refund
      await refundService.processRefund(refundDto);

      // 4. VALIDAR: Commission reversal creado
      const allOutcomes = await outcomeService.findByCommerceAndFilters(testCommerceId, {});
      const commissionReversals = allOutcomes.filter(o => 
        o.conceptType === 'commission-reversal' && 
        o.auxiliaryId === testIncome.id
      );
      
      expect(commissionReversals).toHaveLength(1);
      
      const reversal = commissionReversals[0];
      expect(reversal.amount).toBe(20); // 50% de comisión de 40 = 20
      expect(reversal.beneficiary).toBe(testProfessionalId);

      // 5. VALIDAR: Income mantiene commissionPaid=true (refund parcial)
      const updatedIncome = await incomeService.findById(testIncome.id);
      expect(updatedIncome.commissionPaid).toBe(true); // Parcial no cambia estado
    });

    it('1.5 - REFUND TOTAL con comisión pagada debe marcar commissionPaid=false', async () => {
      // 1. Marcar comisión como pagada
      testIncome.commissionPaid = true;
      testIncome.commissionPaymentId = 'PAYMENT_TEST_456';
      await incomeService.update(testIncome.id, testIncome);

      // 2. Refund total
      const refundDto: CreateRefundDto = {
        originalTransactionId: testIncome.id,
        amount: 200, // 100% refund
        type: 'payment-refund',
        reason: RefundReason.DUPLICATE_PAYMENT,
        clientId: testClientId,
        professionalId: testProfessionalId
      };

      // 3. Ejecutar refund
      await refundService.processRefund(refundDto);

      // 4. VALIDAR: Commission state reset
      const updatedIncome = await incomeService.findById(testIncome.id);
      expect(updatedIncome.commissionPaid).toBe(false);
      expect(updatedIncome.commissionPaymentId).toBeNull();
    });

    it('1.6 - VALIDACIÓN: No debe permitir refund mayor al monto original', async () => {
      const invalidRefund: CreateRefundDto = {
        originalTransactionId: testIncome.id,
        amount: 300, // Mayor que 200 original
        type: 'cancellation-refund',
        reason: RefundReason.OTHER,
        clientId: testClientId,
        professionalId: testProfessionalId
      };

      await expect(refundService.processRefund(invalidRefund))
        .rejects
        .toThrow(/monto.*excede/i);
    });

    it('1.7 - VALIDACIÓN: No debe permitir refunds acumulados > original', async () => {
      // 1. Primer refund que agote casi todo
      const refund1: CreateRefundDto = {
        originalTransactionId: testIncome.id,
        amount: 180,
        type: 'cancellation-refund',
        reason: RefundReason.SERVICE_ISSUE,
        clientId: testClientId,
        professionalId: testProfessionalId
      };

      await refundService.processRefund(refund1);

      // 2. Segundo refund que excedería el límite
      const refund2: CreateRefundDto = {
        originalTransactionId: testIncome.id,
        amount: 50, // 180 + 50 = 230 > 200 original
        type: 'cancellation-refund',
        reason: RefundReason.OTHER,
        clientId: testClientId,
        professionalId: testProfessionalId
      };

      await expect(refundService.processRefund(refund2))
        .rejects
        .toThrow(/monto.*excede/i);
    });

  });

  describe('✅ EDGE CASES Y ERRORES', () => {

    it('2.1 - DEBE rechazar refund de income inexistente', async () => {
      const invalidRefund: CreateRefundDto = {
        originalTransactionId: 'NONEXISTENT_ID',
        amount: 100,
        type: 'cancellation-refund',
        reason: RefundReason.OTHER,
        clientId: testClientId,
        professionalId: testProfessionalId
      };

      await expect(refundService.processRefund(invalidRefund))
        .rejects
        .toThrow(/no encontrada/i);
    });

    it('2.2 - DEBE manejar refund de amount=0', async () => {
      const zeroRefund: CreateRefundDto = {
        originalTransactionId: testIncome.id,
        amount: 0,
        type: 'cancellation-refund',
        reason: RefundReason.TECHNICAL_ERROR,
        clientId: testClientId,
        professionalId: testProfessionalId
      };

      await expect(refundService.processRefund(zeroRefund))
        .rejects
        .toThrow(/monto.*debe.*mayor/i);
    });

  });

});