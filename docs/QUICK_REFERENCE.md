# Quick Reference Guide

## Common Commands

### Development
```bash
npm run start:local          # Start in development mode
npm run start:local:br       # Start with Brazil environment
npm run build                # Build for production
npm run lint                 # Fix linting issues
npm run lint:check          # Check linting without fixing
npm run format               # Format code with Prettier
```

### Testing
```bash
npm test                     # Run all tests
npm run test:watch           # Run tests in watch mode
npm run test:cov             # Run tests with coverage
npm run test:e2e             # Run E2E tests
```

### Git Hooks
```bash
npm run prepare              # Install Husky hooks (run once)
# Pre-commit hook runs automatically on git commit
```

## Project Structure Quick Reference

```
src/
├── [module]/
│   ├── [module].controller.ts    # HTTP endpoints
│   ├── [module].service.ts        # Business logic
│   ├── [module].module.ts         # Module definition
│   ├── [module].service.spec.ts   # Unit tests
│   ├── dto/                       # Data Transfer Objects
│   ├── model/                     # Entity models
│   └── events/                    # Domain events
```

## Common Patterns

### Create a Service Method
```typescript
public async methodName(params: Type): Promise<ReturnType> {
  try {
    // Business logic
    return result;
  } catch (error) {
    throw new HttpException(
      `Error message: ${error.message}`,
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
```

### Create a Controller Endpoint
```typescript
@UseGuards(AuthGuard)
@Post('/endpoint')
public async endpoint(@Body() dto: DtoClass): Promise<ReturnType> {
  return this.service.method(dto);
}
```

### FireORM Query
```typescript
// Find by ID
await repository.findById(id);

// Find with conditions
await repository
  .whereEqualTo('field', value)
  .whereIn('status', [Status1, Status2])
  .find();

// Create
await repository.create(entity);

// Update
await repository.update(entity);
```

## Environment Variables

```env
NODE_ENV=local|test|prod
PROJECT_ID=firebase-project-id
PRIVATE_KEY={"type":"service_account",...}
CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
PORT=3000
BACKEND_URL=http://localhost:3000
VALIDATE_AUTH=0|1
```

## HTTP Status Codes

- `200` OK
- `201` Created
- `400` Bad Request
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `409` Conflict
- `500` Internal Server Error

## Common Imports

```typescript
import { Injectable } from '@nestjs/common';
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from 'nestjs-fireorm';
import { getRepository } from 'fireorm';
import { AuthGuard } from 'src/auth/auth.guard';
```

## Testing Quick Reference

### Service Test Structure
```typescript
describe('ServiceName', () => {
  let service: ServiceName;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ServiceName,
        { provide: Dependency, useValue: mockDependency },
      ],
    }).compile();
    service = module.get<ServiceName>(ServiceName);
  });

  it('should do something', async () => {
    // Arrange, Act, Assert
  });
});
```

## Module Registration

Add new module to `app.module.ts`:

```typescript
@Module({
  imports: [
    // ... existing modules
    NewModule,
  ],
})
export class AppModule {}
```

## Documentation Files

All documentation is in the `docs/` folder:

- `README.md` - Main project documentation (root)
- `docs/IMPROVEMENTS.md` - List of potential improvements
- `docs/testing.md` - Testing guide
- `docs/modules/` - Module-specific documentation
- `docs/QUICK_REFERENCE.md` - This file
- `docs/SETUP_SUMMARY.md` - Setup and configuration summary
- `.cursorrules` - AI assistant guidelines (root)

## Troubleshooting

### Linting Errors
```bash
npm run lint  # Auto-fix issues
```

### Test Failures
- Check mocks are properly set up
- Verify test data matches expected format
- Check for unhandled promises

### Build Errors
```bash
npm run prebuild  # Clean dist folder
npm run build     # Rebuild
```

