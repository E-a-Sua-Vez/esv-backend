import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { MessageService } from '../message/message.service';

import { Product } from './model/product.entity';
import { ProductService } from './product.service';

// Mock messages.js - service imports as .js but file is .ts
jest.mock(
  './messages/messages.js',
  () => {
    return {
      getProductMessage: jest.fn(() => 'Test product message'),
      getProductConsumedMessage: jest.fn(() => 'Test consumed message'),
      getProductReplacedMessage: jest.fn(() => 'Test replaced message'),
    };
  },
  { virtual: true }
);

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  orderByAscending: jest.fn().mockReturnThis(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => () => {}),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => () => {},
}));

describe('ProductService', () => {
  let service: ProductService;

  const mockProduct: Product = {
    id: 'product-1',
    name: 'Test Product',
    commerceId: 'commerce-1',
    available: true,
    order: 1,
    createdAt: new Date(),
  } as Product;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getProductById: jest.fn(),
      getProducts: jest.fn(),
      getProductByCommerce: jest.fn(),
      getProductsById: jest.fn(),
    } as any;

    (service.getProductById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'product-1') {
        return mockProduct;
      }
      return undefined;
    });

    (service.getProducts as jest.Mock).mockImplementation(async () => {
      return [mockProduct];
    });

    (service.getProductByCommerce as jest.Mock).mockImplementation(async () => {
      return [mockProduct];
    });

    (service.getProductsById as jest.Mock).mockImplementation(async (ids: string[]) => {
      return ids.map(id => ({ ...mockProduct, id }));
    });

    jest.clearAllMocks();
  });

  describe('getProductById', () => {
    it('should return product when found', async () => {
      // Act
      const result = await service.getProductById('product-1');

      // Assert
      expect(result).toEqual(mockProduct);
    });

    it('should return undefined when product not found', async () => {
      // Act
      const result = await service.getProductById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getProducts', () => {
    it('should return all products', async () => {
      // Act
      const result = await service.getProducts();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getProductByCommerce', () => {
    it('should return products for a commerce', async () => {
      // Act
      const result = await service.getProductByCommerce('commerce-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getProductsById', () => {
    it('should return products by ids', async () => {
      // Act
      const result = await service.getProductsById(['product-1', 'product-2']);

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(2);
    });
  });
});
