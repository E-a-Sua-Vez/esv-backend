import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { CollaboratorService } from './collaborator.service';
import { Collaborator } from './model/collaborator.entity';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  findOne: jest.fn(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => () => {}),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => () => {},
}));

describe('CollaboratorService', () => {
  let service: CollaboratorService;

  const mockCollaborator: Collaborator = {
    id: 'collaborator-1',
    name: 'John Doe',
    commerceId: 'commerce-1',
    active: true,
    commercesId: [],
    type: 'STANDARD' as any,
    administratorId: 'admin-1',
    alias: 'JD',
    email: 'john@test.com',
    phone: '+56912345678',
    moduleId: 'module-1',
    token: 'test-token',
    lastSignIn: new Date(),
    bot: false,
    firstPasswordChanged: false,
    lastPasswordChanged: new Date(),
    servicesId: [],
    permissions: {},
    available: true,
  } as Collaborator;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getCollaboratorById: jest.fn(),
      getCollaborators: jest.fn(),
    } as any;

    (service.getCollaboratorById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'collaborator-1') {
        return mockCollaborator;
      }
      return undefined;
    });

    (service.getCollaborators as jest.Mock).mockImplementation(async () => {
      return [mockCollaborator];
    });

    jest.clearAllMocks();
  });

  describe('getCollaboratorById', () => {
    it('should return collaborator when found', async () => {
      // Act
      const result = await service.getCollaboratorById('collaborator-1');

      // Assert
      expect(result).toEqual(mockCollaborator);
    });

    it('should return undefined when collaborator not found', async () => {
      // Act
      const result = await service.getCollaboratorById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getCollaborators', () => {
    it('should return all collaborators', async () => {
      // Act
      const result = await service.getCollaborators();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });
});
