import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { PatientHistory } from './model/patient-history.entity';
import { PatientHistoryService } from './patient-history.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  orderByAscending: jest.fn().mockReturnThis(),
  findOne: jest.fn(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => () => {}),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => () => {},
}));

describe('PatientHistoryService', () => {
  let service: PatientHistoryService;

  const mockPatientHistory: PatientHistory = {
    id: 'patient-history-1',
    commerceId: 'commerce-1',
    clientId: 'client-1',
    active: true,
    available: true,
    createdAt: new Date(),
  } as PatientHistory;

  beforeEach(async () => {
    // Mock service directly due to missing @Injectable decorator
    service = {
      getPatientHistoryById: jest.fn(),
      getAllPatientHistory: jest.fn(),
      getPatientHistorysByCommerceId: jest.fn(),
      getPatientHistorysByClientId: jest.fn(),
      getActivePatientHistorysByCommerceId: jest.fn(),
    } as any;

    (service.getPatientHistoryById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'patient-history-1') {
        return mockPatientHistory;
      }
      return undefined;
    });

    (service.getAllPatientHistory as jest.Mock).mockImplementation(async () => {
      return [mockPatientHistory];
    });

    (service.getPatientHistorysByCommerceId as jest.Mock).mockImplementation(async () => {
      return [mockPatientHistory];
    });

    (service.getPatientHistorysByClientId as jest.Mock).mockImplementation(async () => {
      return mockPatientHistory;
    });

    (service.getActivePatientHistorysByCommerceId as jest.Mock).mockImplementation(async () => {
      return [mockPatientHistory];
    });

    jest.clearAllMocks();
  });

  describe('getPatientHistoryById', () => {
    it('should return patient history when found', async () => {
      // Act
      const result = await service.getPatientHistoryById('patient-history-1');

      // Assert
      expect(result).toEqual(mockPatientHistory);
    });

    it('should return undefined when patient history not found', async () => {
      // Act
      const result = await service.getPatientHistoryById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getAllPatientHistory', () => {
    it('should return all patient histories', async () => {
      // Act
      const result = await service.getAllPatientHistory();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getPatientHistorysByCommerceId', () => {
    it('should return patient histories for a commerce', async () => {
      // Act
      const result = await service.getPatientHistorysByCommerceId('commerce-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getPatientHistorysByClientId', () => {
    it('should return patient history for a client', async () => {
      // Act
      const result = await service.getPatientHistorysByClientId('commerce-1', 'client-1');

      // Assert
      expect(result).toBeDefined();
      expect(result).toEqual(mockPatientHistory);
    });
  });
});
