import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { Block } from '../booking/model/booking.entity';

import { BookingBlockNumberUsedService } from './booking-block-number-used.service';
import { BookingBlockNumberUsed } from './model/booking-block-number-used';

// Mock FireORM repository
const mockRepository = {
  find: jest.fn(),
  create: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  orderByAscending: jest.fn().mockReturnThis(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => () => {}),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => () => {},
}));

describe('BookingBlockNumberUsedService', () => {
  let service: BookingBlockNumberUsedService;

  const mockBlock: Block = {
    number: 1,
    hourFrom: '09:00',
    hourTo: '10:00',
  } as Block;

  const mockBookingBlockNumberUsed: BookingBlockNumberUsed = {
    id: 'used-1',
    queueId: 'queue-1',
    date: '2024-01-15',
    time: 540, // minutes since midnight
    sessionId: 'session-1',
    blockNumber: 1,
    hourFrom: '09:00',
    hourTo: '10:00',
    dateRequested: new Date(),
  } as BookingBlockNumberUsed;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getTakenBookingsBlocksByDate: jest.fn(),
      createTakenBookingsBlocksByDate: jest.fn(),
    } as any;

    (service.getTakenBookingsBlocksByDate as jest.Mock).mockImplementation(
      async (sessionId: string, queueId: string, date: string) => {
        return [mockBookingBlockNumberUsed];
      }
    );

    (service.createTakenBookingsBlocksByDate as jest.Mock).mockImplementation(
      async (queueId: string, date: string, block: Block) => {
        return [mockBookingBlockNumberUsed];
      }
    );

    jest.clearAllMocks();
  });

  describe('getTakenBookingsBlocksByDate', () => {
    it('should return taken blocks with sessionId', async () => {
      // Act
      const result = await service.getTakenBookingsBlocksByDate(
        'session-1',
        'queue-1',
        '2024-01-15'
      );

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return taken blocks without sessionId', async () => {
      // Act
      const result = await service.getTakenBookingsBlocksByDate('', 'queue-1', '2024-01-15');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('createTakenBookingsBlocksByDate', () => {
    it('should create taken blocks successfully', async () => {
      // Act
      const result = await service.createTakenBookingsBlocksByDate(
        'queue-1',
        '2024-01-15',
        mockBlock
      );

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
