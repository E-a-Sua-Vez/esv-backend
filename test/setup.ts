// Global test setup
// This file runs before each test suite

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.PROJECT_ID = 'test-project';
process.env.VALIDATE_AUTH = '0';

// Mock fireorm Collection decorator globally
jest.mock('fireorm', () => {
  const mockRepository = {
    findById: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    whereEqualTo: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereLessThan: jest.fn().mockReturnThis(),
    whereGreaterOrEqualThan: jest.fn().mockReturnThis(),
    whereLessOrEqualThan: jest.fn().mockReturnThis(),
    whereNotEqualTo: jest.fn().mockReturnThis(),
    orderByAscending: jest.fn().mockReturnThis(),
    orderByDescending: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    findOne: jest.fn(),
  };

  return {
    Collection: () => (target: any) => target,
    getRepository: jest.fn(() => mockRepository),
  };
});

// Mock nestjs-fireorm
jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => (target: any, propertyKey: string, parameterIndex: number) => {
    // This decorator does nothing in tests, repository is injected manually
  },
  FireormModule: {
    forRoot: jest.fn(),
    forFeature: jest.fn(),
  },
}));

// Increase timeout for integration tests
jest.setTimeout(30000);

