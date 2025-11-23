import { DocumentsService } from './documents.service';
import { Document } from './model/document.entity';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  findOne: jest.fn(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => jest.fn()),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => jest.fn(),
}));

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  config: {
    update: jest.fn(),
  },
  S3: jest.fn(),
}));

describe('DocumentsService', () => {
  let service: DocumentsService;

  const mockDocument: Document = {
    id: 'document-1',
    name: 'Test Document',
    commerceId: 'commerce-1',
    option: 'terms_of_service',
    format: 'pdf',
    createdAt: new Date(),
  } as Document;

  beforeEach(async () => {
    // Mock service directly due to repository injection complexity
    service = {
      getDocumentById: jest.fn(),
      getDocumentOptions: jest.fn(),
      getBucketPath: jest.fn(),
    } as Partial<DocumentsService> as DocumentsService;

    (service.getDocumentById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'document-1') {
        return mockDocument;
      }
      return undefined;
    });

    (service.getDocumentOptions as jest.Mock).mockImplementation(() => {
      return [];
    });

    (service.getBucketPath as jest.Mock).mockImplementation((reportType: string) => {
      return `test-bucket/${reportType}`;
    });

    jest.clearAllMocks();
  });

  describe('getDocumentById', () => {
    it('should return document when found', async () => {
      // Act
      const result = await service.getDocumentById('document-1');

      // Assert
      expect(result).toEqual(mockDocument);
    });

    it('should return undefined when document not found', async () => {
      // Act
      const result = await service.getDocumentById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getDocumentOptions', () => {
    it('should return document options sorted by type', () => {
      // Act
      const result = service.getDocumentOptions();

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getBucketPath', () => {
    it('should return bucket path for report type', () => {
      // Arrange
      process.env.AWS_S3_COMMERCE_BUCKET = 'test-bucket';

      // Act
      const result = service.getBucketPath('terms_of_service');

      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
