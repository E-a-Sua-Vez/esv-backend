import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { GcpLoggerService } from '../shared/logger/gcp-logger.service';

import { BankAccount } from './model/bank-account';
import { PaymentMethod } from './model/payment-method.enum';
import { Payment } from './model/payment.entity';
import { PaymentService } from './payment.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  create: jest.fn(),
};

describe('PaymentService', () => {
  let service: PaymentService;

  const mockPayment: Payment = {
    id: 'payment-1',
    businessId: 'business-1',
    planId: 'plan-1',
    amount: 100,
    paymentNumber: 'PAY-001',
    paymentDate: new Date(),
    method: PaymentMethod.MONEY,
    createdAt: new Date(),
  } as Payment;

  const mockBankData: BankAccount = {
    id: 'bank-1',
    name: 'Test Account',
    idNumber: '12345678-9',
    bank: 'Test Bank',
    accountType: 'CHECKING',
    accountNumber: '1234567890',
    currency: 'USD',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PaymentService,
          useFactory: (logger: GcpLoggerService) => {
            const service = new PaymentService(mockRepository as any, logger);
            return service;
          },
          inject: [GcpLoggerService],
        },
        {
          provide: GcpLoggerService,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
            logWithRequest: jest.fn(),
            logError: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);

    jest.clearAllMocks();
  });

  describe('getPaymentById', () => {
    it('should return payment when found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(mockPayment);

      // Act
      const result = await service.getPaymentById('payment-1');

      // Assert
      expect(result).toEqual(mockPayment);
      expect(mockRepository.findById).toHaveBeenCalledWith('payment-1');
    });

    it('should return undefined when payment not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(undefined);

      // Act
      const result = await service.getPaymentById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('createPayment', () => {
    it('should create payment successfully', async () => {
      // Arrange
      mockRepository.create.mockResolvedValue(mockPayment);

      // Act
      const result = await service.createPayment(
        'user-1',
        'business-1',
        'plan-1',
        100,
        'PAY-001',
        new Date(),
        mockBankData,
        PaymentMethod.MONEY
      );

      // Assert
      expect(result).toEqual(mockPayment);
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should throw error if required fields are missing', async () => {
      // Act & Assert
      await expect(
        service.createPayment(
          'user-1',
          undefined,
          'plan-1',
          100,
          'PAY-001',
          new Date(),
          mockBankData,
          PaymentMethod.MONEY
        )
      ).rejects.toThrow(HttpException);
      await expect(
        service.createPayment(
          'user-1',
          undefined,
          'plan-1',
          100,
          'PAY-001',
          new Date(),
          mockBankData,
          PaymentMethod.MONEY
        )
      ).rejects.toThrow('No hay suficientes crear el pago');
    });

    it('should throw error if amount is negative', async () => {
      // Act & Assert
      await expect(
        service.createPayment(
          'user-1',
          'business-1',
          'plan-1',
          -100,
          'PAY-001',
          new Date(),
          mockBankData,
          PaymentMethod.MONEY
        )
      ).rejects.toThrow(HttpException);
      await expect(
        service.createPayment(
          'user-1',
          'business-1',
          'plan-1',
          -100,
          'PAY-001',
          new Date(),
          mockBankData,
          PaymentMethod.MONEY
        )
      ).rejects.toThrow('Monto debe ser mayor a 0');
    });
  });
});
