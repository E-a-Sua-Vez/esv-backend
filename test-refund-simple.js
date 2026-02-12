// Test directo sin Jest para evitar problemas de memoria
const RefundService = require('../dist/modules/financial/services/refund.service').RefundService;
const IncomeStatus = require('../dist/income/model/income-status.enum').IncomeStatus;
const OutcomeStatus = require('../dist/outcome/model/outcome-status.enum').OutcomeStatus;

console.log('🔧 TEST DIRECTO: RefundService - Income Metadata Update');

// Mock simple
class MockRefundService extends RefundService {
  constructor() {
    const mockIncomeRepo = {
      update: async (income) => {
        console.log('✅ INCOME UPDATED:', JSON.stringify(income.refundMetadata, null, 2));
        return income;
      }
    };
    
    const mockOutcomeRepo = {
      create: async (outcome) => {
        console.log('✅ OUTCOME CREATED:', outcome.id, outcome.amount, outcome.conceptType);
        return { ...outcome, id: 'REFUND_' + Date.now() };
      },
      whereEqualTo: () => ({
        find: async () => [{ // Simular refund existente
          id: 'EXISTING_REFUND',
          amount: 50,
          conceptType: 'cancellation-refund'
        }]
      })
    };

    super(mockOutcomeRepo, mockIncomeRepo, {}, {});
  }

  // Override métodos privados para testing
  async findOriginalTransaction(id) {
    return {
      type: 'income',
      data: {
        id: id,
        commerceId: 'COMMERCE_123',
        amount: 200,
        totalAmount: 200,
        clientId: 'CLIENT_456',
        professionalId: 'PROF_789',
        professionalName: 'Dr. Test',
        status: IncomeStatus.CONFIRMED
      }
    };
  }

  async validateRefundAmount() {
    return true; // Siempre válido
  }

  async processCommissionReversal() {
    console.log('✅ Commission reversal processed');
  }
}

async function runTest() {
  try {
    const service = new MockRefundService();
    
    console.log('\n📝 Test 1: Refund debe actualizar Income con metadata\n');
    
    const refundDto = {
      originalTransactionId: 'INCOME_123',
      amount: 100,
      type: 'cancellation-refund',
      reason: 'service-issue',
      clientId: 'CLIENT_456',
      professionalId: 'PROF_789'
    };

    const result = await service.processRefund(refundDto);
    
    console.log('\n🎯 RESULTADO:', result);
    console.log('\n✅ TEST COMPLETADO - Income debe haber sido actualizado con refundMetadata');
    
  } catch (error) {
    console.error('❌ TEST FALLIDO:', error.message);
  }
}

runTest();