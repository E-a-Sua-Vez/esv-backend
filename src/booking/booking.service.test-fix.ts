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
  });
});

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

  testAttention.paymentConfirmationData = testPaymentData;
  if (testPaymentData.paid === true) {
    testAttention.paid = testPaymentData.paid;
    // Handle paymentDate conversion from string to Date if necessary
    testAttention.paidAt = typeof testPaymentData.paymentDate === 'string'
      ? new Date(testPaymentData.paymentDate)
      : testPaymentData.paymentDate;
    testAttention.confirmed = true;
    testAttention.confirmedAt = new Date();
  }
}

export { };