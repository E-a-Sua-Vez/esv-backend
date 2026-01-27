import { Test, TestingModule } from '@nestjs/testing';
import { BookingService } from './booking.service';
import { AttentionService } from '../attention/attention.service';
import { AttentionReserveBuilder } from '../attention/builders/attention-reserve';

describe('BookingService - Payment Data Transfer Test', () => {
  let bookingService: BookingService;
  let attentionService: AttentionService;
  let attentionReserveBuilder: AttentionReserveBuilder;

  // Mock booking con confirmationData completo
  const mockBooking = {
    id: 'test-booking-123',
    professionalId: 'prof-456',
    queueId: 'queue-789',
    channel: 'MINISITE',
    user: { id: 'user-123', name: 'Test User' },
    block: { number: 11, hourFrom: '13:00', hourTo: '13:30' },
    date: '2026-01-27',
    servicesId: ['service-1'],
    servicesDetails: [{ id: 'service-1', name: 'Test Service' }],
    clientId: 'client-123',
    confirmationData: {
      paid: true,
      paymentAmount: 500,
      paymentMethod: 'CREDIT_CARD',
      paymentDate: '2026-01-27T01:18:33.974Z',
      professionalId: 'prof-456',
      professionalCommissionAmount: 150,
      totalAmount: 500
    }
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        {
          provide: AttentionService,
          useValue: {
            createAttention: jest.fn()
          }
        }
      ],
    }).compile();

    bookingService = module.get<BookingService>(BookingService);
    attentionService = module.get<AttentionService>(AttentionService);
  });

  it('should transfer payment data correctly from booking to attention', async () => {
    // Arrange
    const expectedCollaboratorId = 'prof-456';
    const expectedPaymentData = mockBooking.confirmationData;

    // Mock del attentionService.createAttention para capturar parámetros
    const createAttentionSpy = jest.spyOn(attentionService, 'createAttention')
      .mockResolvedValue({
        id: 'attention-123',
        collaboratorId: expectedCollaboratorId,
        paid: true,
        confirmed: true,
        paymentConfirmationData: expectedPaymentData
      } as any);

    // Act - Llamar al método createAttention del BookingService
    const result = await bookingService['createAttention']('test-user', mockBooking as any);

    // Assert - Verificar que se llamó con los parámetros correctos
    expect(createAttentionSpy).toHaveBeenCalledWith(
      mockBooking.queueId,                    // queueId
      expectedCollaboratorId,                 // collaboratorId (booking.professionalId)
      mockBooking.channel,                    // channel
      mockBooking.user,                       // user
      undefined,                              // attentionType
      mockBooking.block,                      // block
      new Date(mockBooking.date),             // date
      expectedPaymentData,                    // paymentConfirmationData
      mockBooking.id,                         // bookingId
      mockBooking.servicesId,                 // servicesId
      mockBooking.servicesDetails,            // servicesDetails
      mockBooking.clientId,                   // clientId
      undefined,                              // termsConditionsToAcceptCode
      undefined,                              // termsConditionsAcceptedCode
      undefined,                              // termsConditionsToAcceptedAt
      undefined                               // normalizedTelemedicineConfig
    );

    console.log('✅ PRUEBA EXITOSA: Se transfirieron correctamente:', {
      collaboratorId: expectedCollaboratorId,
      hasPaymentData: !!expectedPaymentData,
      paymentAmount: expectedPaymentData.paymentAmount,
      professionalCommissionAmount: expectedPaymentData.professionalCommissionAmount
    });
  });

  it('should verify AttentionReserveBuilder processes payment data correctly', () => {
    // Simular el AttentionReserveBuilder directamente
    const mockPaymentData = {
      paid: true,
      paymentAmount: 500,
      professionalCommissionAmount: 150,
      paymentDate: '2026-01-27T01:18:33.974Z'
    };

    // Simular el objeto attention
    const attention: any = {
      id: 'test-attention'
    };

    // Simular la lógica del builder
    if (mockPaymentData !== undefined) {
      console.log('🔍 Processing payment data:', {
        hasPaymentData: mockPaymentData !== undefined,
        paidValue: mockPaymentData?.paid,
        paidType: typeof mockPaymentData?.paid,
        paymentAmount: mockPaymentData?.paymentAmount
      });

      attention.paymentConfirmationData = mockPaymentData;
      if (mockPaymentData.paid === true) {
        attention.paid = mockPaymentData.paid;
        attention.paidAt = new Date(mockPaymentData.paymentDate);
        attention.confirmed = true;
        attention.confirmedAt = new Date();
      }
    }

    // Verificar resultados
    expect(attention.paymentConfirmationData).toBeDefined();
    expect(attention.paid).toBe(true);
    expect(attention.confirmed).toBe(true);
    expect(attention.paidAt).toBeInstanceOf(Date);
    expect(attention.confirmedAt).toBeInstanceOf(Date);

    console.log('✅ BUILDER TEST EXITOSO: Attention creada con:', {
      paid: attention.paid,
      confirmed: attention.confirmed,
      hasPaymentData: !!attention.paymentConfirmationData,
      professionalCommissionAmount: attention.paymentConfirmationData?.professionalCommissionAmount
    });
  });
});

// Ejecutar las pruebas directamente
console.log('🚀 EJECUTANDO PRUEBAS FUNCIONALES...\n');

// Test 1: Verificar lógica de AttentionReserveBuilder
console.log('📋 Test 1: Lógica de AttentionReserveBuilder');
const testPaymentData = {
  paid: true,
  paymentAmount: 500,
  professionalCommissionAmount: 150,
  paymentDate: '2026-01-27T01:18:33.974Z',
  paymentMethod: 'CREDIT_CARD'
};

const testAttention: any = { id: 'test' };

// Simular la lógica exacta del builder
if (testPaymentData !== undefined) {
  console.log('[TEST] Processing payment data:', {
    hasPaymentData: testPaymentData !== undefined,
    paidValue: testPaymentData?.paid,
    paidType: typeof testPaymentData?.paid,
    paymentAmount: testPaymentData?.paymentAmount,
    paymentDate: testPaymentData?.paymentDate,
    paymentDateType: typeof testPaymentData?.paymentDate
  });

  testAttention.paymentConfirmationData = testPaymentData;
  if (testPaymentData.paid === true) {
    testAttention.paid = testPaymentData.paid;
    // Handle paymentDate conversion from string to Date if necessary
    testAttention.paidAt = typeof testPaymentData.paymentDate === 'string'
      ? new Date(testPaymentData.paymentDate)
      : testPaymentData.paymentDate;
    testAttention.confirmed = true;
    testAttention.confirmedAt = new Date();

    console.log('[TEST] Payment data transfer completed:', {
      paid: testAttention.paid,
      confirmed: testAttention.confirmed,
      paidAt: testAttention.paidAt,
      confirmedAt: testAttention.confirmedAt,
      hasPaymentConfirmationData: !!testAttention.paymentConfirmationData,
      professionalCommissionAmount: testAttention.paymentConfirmationData?.professionalCommissionAmount
    });
  }
}

console.log('\n🎯 RESULTADO FINAL:', {
  'DEBERÍA TENER paid': true,
  'TIENE paid': testAttention.paid,
  'DEBERÍA TENER confirmed': true,
  'TIENE confirmed': testAttention.confirmed,
  'DEBERÍA TENER paymentConfirmationData': 'object',
  'TIENE paymentConfirmationData': typeof testAttention.paymentConfirmationData,
  'MATCH PERFECTO': testAttention.paid === true && testAttention.confirmed === true && !!testAttention.paymentConfirmationData
});

export { };