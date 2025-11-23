import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ClientService } from '../client/client.service';
import { Client } from '../client/model/client.entity';
import { CommerceService } from '../commerce/commerce.service';
import { Commerce } from '../commerce/model/commerce.entity';
import { GcpLoggerService } from '../shared/logger/gcp-logger.service';

import { UserType } from './model/user-type.enum';
import { User } from './model/user.entity';
import { UserService } from './user.service';

// Mock FireORM repository
interface MockRepository {
  findById: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
}

const mockRepository: MockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

describe('UserService', () => {
  let service: UserService;
  let clientService: ClientService;
  let commerceService: CommerceService;

  const mockUser: User = {
    id: 'user-1',
    name: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+56912345678',
    commerceId: 'commerce-1',
    businessId: 'business-1',
    type: UserType.STANDARD,
  } as User;

  const mockCommerce: Partial<Commerce> = {
    id: 'commerce-1',
    businessId: 'business-1',
  };

  beforeEach(async () => {
    const mockClientService: Partial<ClientService> = {
      getClientById: jest.fn(),
      saveClient: jest.fn(),
    };
    const mockCommerceService: Partial<CommerceService> = {
      getCommerce: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: UserService,
          useFactory: (logger: GcpLoggerService) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return new UserService(
              mockRepository as any,
              mockClientService as ClientService,
              mockCommerceService as CommerceService,
              logger
            );
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
        {
          provide: ClientService,
          useValue: mockClientService,
        },
        {
          provide: CommerceService,
          useValue: mockCommerceService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    clientService = module.get<ClientService>(ClientService);
    commerceService = module.get<CommerceService>(CommerceService);

    // Set repository mock
    Object.defineProperty(service, 'userRepository', {
      value: mockRepository,
      writable: true,
    });

    jest.clearAllMocks();
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.getUserById('user-1');

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockRepository.findById).toHaveBeenCalledWith('user-1');
    });

    it('should return undefined when user not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(undefined);

      // Act
      const result = await service.getUserById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getUsers', () => {
    it('should return all users', async () => {
      // Arrange
      const users = [mockUser];
      mockRepository.find.mockResolvedValue(users);

      // Act
      const result = await service.getUsers();

      // Assert
      expect(result).toEqual(users);
      expect(mockRepository.find).toHaveBeenCalled();
    });
  });

  describe('createUser', () => {
    it('should throw error if commerceId is not provided', async () => {
      // Act & Assert
      await expect(
        service.createUser('John', '+56912345678', 'john@example.com', undefined)
      ).rejects.toThrow(HttpException);
      await expect(
        service.createUser('John', '+56912345678', 'john@example.com', undefined)
      ).rejects.toThrow('Debe enviarse el commerceId');
    });

    it('should create user successfully with commerceId', async () => {
      // Arrange
      jest.spyOn(commerceService, 'getCommerce').mockResolvedValue(mockCommerce as Commerce);
      jest.spyOn(clientService, 'saveClient').mockResolvedValue({ id: 'client-1' } as Client);
      mockRepository.create.mockResolvedValue(mockUser);

      // Act
      const result = await service.createUser(
        'John',
        '+56912345678',
        'john@example.com',
        'commerce-1'
      );

      // Assert
      expect(result).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalled();
      expect(commerceService.getCommerce).toHaveBeenCalledWith('commerce-1');
    });

    it('should throw error if clientId provided but client does not exist', async () => {
      // Arrange
      jest.spyOn(commerceService, 'getCommerce').mockResolvedValue(mockCommerce as Commerce);
      jest.spyOn(clientService, 'getClientById').mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        service.createUser(
          'John',
          '+56912345678',
          'john@example.com',
          'commerce-1',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          'non-existent'
        )
      ).rejects.toThrow(HttpException);
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      // Arrange
      const updatedUser = { ...mockUser, name: 'Jane' };
      mockRepository.findById.mockResolvedValue(mockUser);
      mockRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await service.updateUser('user-1', 'user-1', 'Jane');

      // Assert
      expect(result).toBeDefined();
      expect(mockRepository.update).toHaveBeenCalled();
    });
  });
});
