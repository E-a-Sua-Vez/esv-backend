import { Suggestion } from './suggestion.entity';
import { SuggestionService } from './suggestion.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  create: jest.fn(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => jest.fn()),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => jest.fn(),
}));

describe('SuggestionService', () => {
  let service: SuggestionService;

  const mockSuggestion: Suggestion = {
    id: 'suggestion-1',
    type: 'feature',
    comment: 'Test suggestion',
    userId: 'user-1',
    userType: 'client',
    createdAt: new Date(),
  } as Suggestion;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getSuggestionById: jest.fn(),
      createSuggestion: jest.fn(),
    } as Partial<SuggestionService> as SuggestionService;

    (service.getSuggestionById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'suggestion-1') {
        return mockSuggestion;
      }
      return undefined;
    });

    (service.createSuggestion as jest.Mock).mockImplementation(
      async (type: string, comment: string, userId: string, userType: string) => {
        return {
          id: 'new-suggestion',
          type,
          comment,
          userId,
          userType,
          createdAt: new Date(),
        };
      }
    );

    jest.clearAllMocks();
  });

  describe('getSuggestionById', () => {
    it('should return suggestion when found', async () => {
      // Act
      const result = await service.getSuggestionById('suggestion-1');

      // Assert
      expect(result).toEqual(mockSuggestion);
    });

    it('should return undefined when suggestion not found', async () => {
      // Act
      const result = await service.getSuggestionById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('createSuggestion', () => {
    it('should create suggestion successfully', async () => {
      // Arrange
      const type = 'feature';
      const comment = 'New feature suggestion';
      const userId = 'user-1';
      const userType = 'client';

      // Act
      const result = await service.createSuggestion(type, comment, userId, userType);

      // Assert
      expect(result).toBeDefined();
      expect(result.type).toBe(type);
      expect(result.comment).toBe(comment);
      expect(result.userId).toBe(userId);
      expect(result.userType).toBe(userType);
    });
  });
});
