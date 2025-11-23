# Testing Guide

## Overview

This guide covers unit testing, integration testing, and testing best practices for the ESV Backend project.

## Table of Contents

- [Testing Setup](#testing-setup)
- [Running Tests](#running-tests)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [Test Examples](#test-examples)
- [Testing Patterns](#testing-patterns)
- [Mocking Strategies](#mocking-strategies)
- [Coverage Goals](#coverage-goals)

## Testing Setup

### Dependencies

The project uses:
- **Jest**: Test runner and assertion library
- **@nestjs/testing**: NestJS testing utilities
- **ts-jest**: TypeScript support for Jest

### Configuration

Jest is configured in `jest.config.js`:

```javascript
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // ... more config
};
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run specific test file
npm test -- booking.service.spec.ts

# Run tests matching a pattern
npm test -- --testNamePattern="createBooking"
```

## Unit Testing

### Structure

Unit tests are located alongside source files with `.spec.ts` extension:

```
src/
├── booking/
│   ├── booking.service.ts
│   └── booking.service.spec.ts
```

### Test File Structure

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceName } from './service.name';

describe('ServiceName', () => {
  let service: ServiceName;
  let mockDependency: MockDependency;

  beforeEach(async () => {
    // Setup test module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceName,
        {
          provide: DependencyService,
          useValue: mockDependency,
        },
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
  });

  describe('methodName', () => {
    it('should do something', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

## Integration Testing

### E2E Tests

E2E tests are located in `test/` directory with `.e2e-spec.ts` extension:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('BookingController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/booking (POST)', () => {
    return request(app.getHttpServer())
      .post('/booking')
      .send({ /* request body */ })
      .expect(201);
  });
});
```

## Test Examples

### Example 1: Service Method Test

**Service Method:**
```typescript
public async getBookingById(id: string): Promise<Booking> {
  return await this.bookingRepository.findById(id);
}
```

**Test:**
```typescript
describe('getBookingById', () => {
  it('should return a booking when found', async () => {
    // Arrange
    const bookingId = 'booking-1';
    const expectedBooking = { id: bookingId, /* ... */ };
    mockRepository.findById.mockResolvedValue(expectedBooking);

    // Act
    const result = await service.getBookingById(bookingId);

    // Assert
    expect(result).toEqual(expectedBooking);
    expect(mockRepository.findById).toHaveBeenCalledWith(bookingId);
    expect(mockRepository.findById).toHaveBeenCalledTimes(1);
  });

  it('should return undefined when booking not found', async () => {
    // Arrange
    mockRepository.findById.mockResolvedValue(undefined);

    // Act
    const result = await service.getBookingById('non-existent');

    // Assert
    expect(result).toBeUndefined();
  });
});
```

**Input/Output:**
- **Input**: `id: 'booking-1'`
- **Output**: `Booking` object or `undefined`
- **Flow**: Repository.findById → Return result

### Example 2: Complex Business Logic Test

**Service Method:**
```typescript
public async createBooking(
  queueId: string,
  channel: string,
  date: string,
  user: User,
  block: Block
): Promise<Booking> {
  // Complex validation and creation logic
}
```

**Test Flow Chart:**
```
┌─────────────────┐
│  createBooking  │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Validate User Terms │
└────────┬────────────┘
         │
    ┌────┴────┐
    │  Valid? │
    └────┬────┘
         │
    ┌────┴────┐
    │   NO    │──► Throw Error
    └────┬────┘
         │
    ┌────┴────┐
    │  YES    │
    └────┬────┘
         │
         ▼
┌─────────────────────┐
│ Validate Block      │
│ Availability        │
└────────┬────────────┘
         │
    ┌────┴────┐
    │ Available?│
    └────┬────┘
         │
    ┌────┴────┐
    │   NO    │──► Throw Error
    └────┬────┘
         │
    ┌────┴────┐
    │  YES    │
    └────┬────┘
         │
         ▼
┌─────────────────────┐
│ Check Queue Limit   │
└────────┬────────────┘
         │
    ┌────┴────┐
    │ Under Limit?│
    └────┬────┘
         │
    ┌────┴────┐
    │   NO    │──► Throw Error
    └────┬────┘
         │
    ┌────┴────┐
    │  YES    │
    └────┬────┘
         │
         ▼
┌─────────────────────┐
│ Create Booking      │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Send Notifications  │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Return Booking      │
└─────────────────────┘
```

**Test Cases:**

```typescript
describe('createBooking', () => {
  it('should create booking successfully', async () => {
    // Arrange
    const params = { queueId: 'q1', date: '2024-01-15', user: mockUser, block: mockBlock };
    jest.spyOn(service, 'validateBookingBlocksToCreate').mockResolvedValue(true);
    jest.spyOn(service, 'getPendingBookingsByQueueAndDate').mockResolvedValue([]);
    jest.spyOn(bookingBuilder, 'create').mockResolvedValue(mockBooking);

    // Act
    const result = await service.createBooking(/* params */);

    // Assert
    expect(result).toEqual(mockBooking);
    expect(bookingBuilder.create).toHaveBeenCalled();
  });

  it('should throw error if user has not accepted terms', async () => {
    // Arrange
    const userWithoutTerms = { ...mockUser, acceptTermsAndConditions: false };

    // Act & Assert
    await expect(
      service.createBooking(/* params with userWithoutTerms */)
    ).rejects.toThrow(HttpException);
  });

  it('should throw error if queue limit is reached', async () => {
    // Arrange
    const existingBookings = Array(10).fill(mockBooking);
    jest.spyOn(service, 'getPendingBookingsByQueueAndDate').mockResolvedValue(existingBookings);

    // Act & Assert
    await expect(service.createBooking(/* params */)).rejects.toThrow(HttpException);
  });
});
```

**Input/Output:**
- **Input**:
  - `queueId: string`
  - `channel: BookingChannel`
  - `date: string` (YYYY-MM-DD)
  - `user: User` (with acceptTermsAndConditions: true)
  - `block: Block`
- **Output**: `Booking` object
- **Error Cases**:
  - User hasn't accepted terms → `HttpException` (500)
  - Block unavailable → `HttpException` (409)
  - Queue limit reached → `HttpException` (500)

### Example 3: Error Handling Test

```typescript
describe('cancelBooking', () => {
  it('should cancel booking successfully', async () => {
    // Arrange
    const bookingId = 'booking-1';
    const userId = 'user-1';
    mockRepository.findById.mockResolvedValue(mockBooking);
    jest.spyOn(service, 'update').mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.RESERVE_CANCELLED,
      cancelled: true,
    });

    // Act
    const result = await service.cancelBooking(userId, bookingId);

    // Assert
    expect(result.status).toBe(BookingStatus.RESERVE_CANCELLED);
    expect(result.cancelled).toBe(true);
    expect(result.cancelledAt).toBeDefined();
  });

  it('should throw error if booking does not exist', async () => {
    // Arrange
    mockRepository.findById.mockResolvedValue(undefined);

    // Act & Assert
    await expect(service.cancelBooking('user-1', 'non-existent')).rejects.toThrow(
      HttpException
    );
  });
});
```

## Testing Patterns

### AAA Pattern (Arrange-Act-Assert)

```typescript
it('should do something', async () => {
  // Arrange: Set up test data and mocks
  const input = { /* ... */ };
  mockService.method.mockResolvedValue(expectedOutput);

  // Act: Execute the method under test
  const result = await service.method(input);

  // Assert: Verify the results
  expect(result).toEqual(expectedOutput);
  expect(mockService.method).toHaveBeenCalledWith(input);
});
```

### Test Isolation

Each test should be independent:
- Use `beforeEach` to set up fresh state
- Reset mocks with `jest.clearAllMocks()`
- Don't rely on test execution order

### Descriptive Test Names

```typescript
// Good
it('should throw error when queue limit is reached', async () => { /* ... */ });
it('should create booking with valid user and available block', async () => { /* ... */ });

// Bad
it('should work', async () => { /* ... */ });
it('test 1', async () => { /* ... */ });
```

## Mocking Strategies

### Mocking Dependencies

```typescript
const mockQueueService = {
  getQueueById: jest.fn(),
  createQueue: jest.fn(),
};

// In test module
{
  provide: QueueService,
  useValue: mockQueueService,
}
```

### Mocking FireORM Repository

```typescript
const mockRepository = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  find: jest.fn(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
}));
```

### Mocking Async Operations

```typescript
// Resolve
mockService.method.mockResolvedValue(result);

// Reject
mockService.method.mockRejectedValue(new Error('Error message'));

// Multiple calls
mockService.method
  .mockResolvedValueOnce(result1)
  .mockResolvedValueOnce(result2);
```

### Spying on Methods

```typescript
// Spy on service method
jest.spyOn(service, 'methodName').mockResolvedValue(result);

// Spy on private method (if needed)
jest.spyOn(service as any, 'privateMethod').mockResolvedValue(result);
```

## Coverage Goals

### Target Coverage

- **Overall**: 70%+
- **Services**: 80%+
- **Controllers**: 60%+
- **Critical Business Logic**: 90%+

### Coverage Reports

```bash
# Generate coverage report
npm run test:cov

# View coverage in browser
open coverage/lcov-report/index.html
```

### What to Test

**Must Test:**
- ✅ All public service methods
- ✅ Error handling paths
- ✅ Business logic validation
- ✅ Edge cases

**Should Test:**
- ✅ Controller endpoints (via E2E)
- ✅ Integration between modules
- ✅ Event publishing

**Nice to Have:**
- ✅ Utility functions
- ✅ Builders
- ✅ DTOs validation

## Best Practices

### 1. Test One Thing at a Time

```typescript
// Good: One assertion per test
it('should return booking when found', async () => {
  const result = await service.getBookingById('id');
  expect(result).toBeDefined();
});

// Bad: Multiple unrelated assertions
it('should do everything', async () => {
  const booking = await service.getBookingById('id');
  const cancelled = await service.cancelBooking('id');
  expect(booking).toBeDefined();
  expect(cancelled).toBeDefined();
});
```

### 2. Use Descriptive Assertions

```typescript
// Good
expect(result.status).toBe(BookingStatus.CONFIRMED);
expect(mockRepository.update).toHaveBeenCalledWith(expectedBooking);

// Bad
expect(result).toBeTruthy();
expect(mockRepository.update).toHaveBeenCalled();
```

### 3. Test Error Cases

```typescript
it('should throw error when input is invalid', async () => {
  await expect(service.method(invalidInput)).rejects.toThrow(HttpException);
});
```

### 4. Keep Tests Fast

- Mock external dependencies
- Avoid real database calls in unit tests
- Use in-memory implementations when possible

### 5. Maintain Test Data

```typescript
// Use factories for test data
const createMockBooking = (overrides = {}) => ({
  id: 'booking-1',
  status: BookingStatus.PENDING,
  ...overrides,
});
```

## Common Testing Scenarios

### Testing with Dependencies

```typescript
describe('Service with Dependencies', () => {
  let service: MyService;
  let dependency1: MockDependency1;
  let dependency2: MockDependency2;

  beforeEach(async () => {
    dependency1 = {
      method1: jest.fn(),
      method2: jest.fn(),
    };
    dependency2 = {
      method1: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        MyService,
        { provide: Dependency1, useValue: dependency1 },
        { provide: Dependency2, useValue: dependency2 },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
  });
});
```

### Testing HTTP Endpoints (E2E)

```typescript
describe('BookingController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/booking (POST)', () => {
    return request(app.getHttpServer())
      .post('/booking')
      .send({
        queueId: 'queue-1',
        date: '2024-01-15',
        // ... more fields
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.status).toBe('PENDING');
      });
  });
});
```

## Troubleshooting

### Common Issues

1. **Tests timing out**
   - Increase timeout: `jest.setTimeout(30000)`
   - Check for unhandled promises

2. **Mocks not working**
   - Ensure mocks are reset in `beforeEach`
   - Check mock implementation matches actual method signature

3. **Module not found errors**
   - Check `moduleNameMapper` in jest.config.js
   - Verify import paths

4. **FireORM repository issues**
   - Mock `getRepository` function
   - Ensure repository methods are properly mocked

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

