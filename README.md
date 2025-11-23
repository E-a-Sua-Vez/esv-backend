# ESV Backend

Backend API for the appointment and queue management system (estuturno/easuavez), serving businesses in healthcare, beauty, restaurants, and other service industries.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Modules](#modules)
- [Development](#development)
- [Testing](#testing)
- [Logging](#logging)
- [Deployment](#deployment)
- [Contributing](#contributing)

## Overview

ESV Backend is a NestJS-based REST API that manages:
- **Bookings**: Appointment scheduling and management
- **Queues**: Service queue management
- **Commerce**: Business location management
- **Clients**: Customer information management
- **Payments**: Payment processing and tracking
- **Notifications**: Email and WhatsApp notifications
- **Attention**: Service attention tracking
- **And more**: See [Modules](#modules) section

## Architecture

### System Architecture

```
┌─────────────┐
│   Clients   │
│  (Web/Mobile)│
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│      ESV Backend (NestJS)        │
│  ┌───────────────────────────┐  │
│  │   Controllers (REST API)   │  │
│  └───────────┬───────────────┘  │
│              ▼                   │
│  ┌───────────────────────────┐  │
│  │   Services (Business)    │  │
│  └───────────┬───────────────┘  │
│              ▼                   │
│  ┌───────────────────────────┐  │
│  │   FireORM Repositories    │  │
│  └───────────┬───────────────┘  │
└──────────────┼──────────────────┘
               ▼
┌─────────────────────────────────┐
│   Google Cloud Firestore         │
└─────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│   External Services              │
│   - Firebase Auth                │
│   - AWS SES (Email)              │
│   - Twilio/WhatsApp Gateway      │
│   - Event Publishing             │
└─────────────────────────────────┘
```

### Module Architecture

The application follows a modular architecture where each domain has its own module:

- **Module**: Defines dependencies and exports
- **Controller**: Handles HTTP requests
- **Service**: Contains business logic
- **Model**: Entity definitions (FireORM)
- **DTO**: Data Transfer Objects for validation
- **Events**: Domain events

## Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) 9.x
- **Language**: TypeScript 4.7
- **Database**: Google Cloud Firestore
- **ORM**: FireORM (via nestjs-fireorm)
- **Authentication**: Firebase Admin SDK
- **Validation**: class-validator
- **Testing**: Jest
- **Linting**: ESLint + Prettier

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Google Cloud Project with Firestore enabled
- Firebase Admin SDK credentials
- Environment variables configured

### Installation

```bash
# Install dependencies
npm install

# Install Husky for git hooks
npm run prepare
```

### Environment Setup

Create environment files based on your environment:

- `local.env` - Local development
- `test.env` - Test environment
- `prod.env` - Production environment

Required environment variables:

```env
NODE_ENV=local
PROJECT_ID=your-firebase-project-id
PRIVATE_KEY={"type":"service_account",...}
CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
PORT=3000
BACKEND_URL=http://localhost:3000
VALIDATE_AUTH=0
EMAIL_SOURCE=noreply@example.com
```

### Running the Application

```bash
# Development mode (watch)
npm run start:local

# Development mode (Brazil environment)
npm run start:local:br

# Production mode
npm run start:prod
```

The application will be available at `http://localhost:3000`

## Project Structure

```
src/
├── administrator/          # Administrator management
├── attention/             # Service attention tracking
├── auth/                  # Authentication guards
├── block/                 # Time block management
├── booking/               # Booking/appointment management
├── business/              # Business entity management
├── client/                # Client/customer management
├── client-contact/         # Client contact information
├── collaborator/          # Staff/collaborator management
├── commerce/              # Commerce/location management
├── company/               # Company management
├── documents/             # Document management
├── feature/               # Feature management
├── feature-toggle/        # Feature flags
├── form/                  # Form management
├── form-personalized/     # Custom forms
├── health/                # Health check endpoints
├── income/                # Income/financial tracking
├── message/               # Messaging system
├── module/                # Module management
├── notification/          # Notification service (email/WhatsApp)
├── outcome/               # Outcome tracking
├── outcome-type/          # Outcome type definitions
├── package/               # Package management
├── partner/               # Partner management
├── patient-history/       # Patient history
├── payment/               # Payment processing
├── plan/                  # Subscription plans
├── plan-activation/       # Plan activation management
├── product/               # Product management
├── queue/                 # Queue management
├── rol/                   # Role management
├── service/               # Service management
├── shared/                # Shared utilities
│   ├── events/           # Event definitions
│   ├── interfaces/       # Shared interfaces
│   ├── model/            # Shared models
│   └── utils/            # Utility functions
├── suggestion/            # Suggestion system
├── survey/                # Survey management
├── survey-personalized/   # Custom surveys
├── user/                  # User management
├── waitlist/              # Waitlist management
├── app.module.ts          # Root module
├── app.controller.ts      # Root controller
├── app.service.ts         # Root service
└── main.ts                # Application entry point
```

## Modules

### Core Modules

#### Booking Module
Manages appointment bookings and reservations.

**Key Features:**
- Create, confirm, cancel bookings
- Transfer bookings between queues
- Process bookings into attention records
- Block validation and availability checking
- Integration with waitlist

**Endpoints:**
- `POST /booking` - Create booking
- `GET /booking/:id` - Get booking details
- `PATCH /booking/confirm/:id` - Confirm booking
- `PATCH /booking/cancel/:id` - Cancel booking
- `PATCH /booking/transfer/:id` - Transfer to another queue

**See**: [docs/modules/booking.md](docs/modules/booking.md)

#### Commerce Module
Manages business locations and their configuration.

**Key Features:**
- Commerce CRUD operations
- Service hours configuration
- Locale settings (language, timezone)
- WhatsApp connection management

#### Queue Module
Manages service queues within a commerce.

**Key Features:**
- Queue creation and management
- Block scheduling
- Queue types (standard, select service)
- Limit management

#### Notification Module
Handles email and WhatsApp notifications.

**Key Features:**
- Email notifications via AWS SES
- WhatsApp notifications via Twilio/WhatsApp Gateway
- Template-based messages
- Multi-language support
- Feature toggle integration

### Supporting Modules

- **Client**: Customer information management
- **User**: User account management
- **Payment**: Payment processing and tracking
- **Income**: Financial income tracking
- **Attention**: Service attention records
- **Waitlist**: Waitlist management
- **Survey**: Customer satisfaction surveys
- **Plan**: Subscription plan management
- **Feature Toggle**: Feature flag management

## Development

### Code Style

The project uses ESLint and Prettier for code formatting:

```bash
# Check linting
npm run lint:check

# Fix linting issues
npm run lint

# Format code
npm run format

# Check formatting
npm run format:check
```

### Pre-commit Hooks

Husky is configured to run linting and formatting before commits:

- ESLint checks
- Prettier formatting
- Only staged files are checked

### Adding a New Module

1. Generate module structure:
```bash
nest g module module-name
nest g service module-name
nest g controller module-name
```

2. Create model in `module-name/model/`
3. Create DTOs in `module-name/dto/`
4. Register module in `app.module.ts`
5. Add tests in `module-name/*.spec.ts`

### Common Patterns

#### Service Method
```typescript
@Injectable()
export class MyService {
  constructor(
    @InjectRepository(MyEntity)
    private repository = getRepository(MyEntity),
  ) {}

  public async create(data: CreateDto): Promise<MyEntity> {
    try {
      const entity = await this.repository.create(data);
      return entity;
    } catch (error) {
      throw new HttpException(
        `Error message: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
```

#### Controller Endpoint
```typescript
@Controller('my-module')
export class MyController {
  constructor(private readonly service: MyService) {}

  @UseGuards(AuthGuard)
  @Post()
  public async create(@Body() dto: CreateDto): Promise<MyEntity> {
    return this.service.create(dto);
  }
}
```

## Testing

### Running Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

### Test Structure

Tests are located alongside source files with `.spec.ts` extension:

```
src/
├── booking/
│   ├── booking.service.ts
│   └── booking.service.spec.ts
```

### Writing Tests

See [docs/testing.md](docs/testing.md) for detailed testing guidelines and examples.

## Logging

The application uses a GCP-compatible structured logging system that outputs JSON logs compatible with Google Cloud Logging.

### Features

- ✅ **Structured JSON logging** - All logs in GCP-compatible format
- ✅ **Automatic request/response logging** - Via LoggingInterceptor
- ✅ **Error tracking** - Full stack traces with context
- ✅ **Security event logging** - Auth failures, bypasses, etc.
- ✅ **Trace context support** - For distributed tracing in GCP
- ✅ **Sensitive data sanitization** - Automatic redaction of passwords, tokens, etc.

### Log Format

All logs are output as structured JSON:

```json
{
  "severity": "INFO|WARNING|ERROR|DEBUG|CRITICAL",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "message": "Log message",
  "context": "ServiceName",
  "environment": "local|test|prod",
  "service": "esv-backend",
  "httpRequest": { ... },
  "user": "user@example.com",
  "userId": "user-123"
}
```

### Usage in Services

```typescript
import { GcpLoggerService } from '../shared/logger/gcp-logger.service';

@Injectable()
export class MyService {
  constructor(private readonly logger: GcpLoggerService) {
    this.logger.setContext('MyService');
  }

  public async doSomething(): Promise<void> {
    this.logger.info('Doing something', { param: 'value' });

    try {
      // operation
    } catch (error) {
      this.logger.logError(error, request, { operation: 'doSomething' });
      throw error;
    }
  }
}
```

### GCP Cloud Logging

When deployed to GCP, logs are automatically:
- Captured by Cloud Logging
- Searchable by severity, context, service
- Correlated with traces
- Retained according to GCP policies

### Documentation

- [Logging System Guide](docs/LOGGING_SYSTEM.md) - Complete logging documentation
- [Logging Improvements](docs/LOGGING_IMPROVEMENTS.md) - Implementation details
- [Logging Recommendations](docs/LOGGING_RECOMMENDATIONS.md) - Best practices and migration guide

## API Documentation

The API is fully documented using Swagger/OpenAPI. Access the interactive API documentation at:

**Swagger UI**: `http://localhost:3000/api-docs`

### Features

- Interactive API explorer
- Try out endpoints directly from the browser
- JWT authentication support
- Request/response examples
- Schema definitions

### Postman Collection

A Postman collection is automatically generated from the OpenAPI specification. See [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) for details on generating and using the Postman collection.

### Documentation Status

- ✅ 13 controllers fully documented with Swagger decorators
- ⚠️ 25 controllers need Swagger decorators added

See [docs/SWAGGER_SETUP.md](docs/SWAGGER_SETUP.md) for instructions on completing the documentation for all controllers.

## Deployment

### Build

```bash
npm run build
```

### Environment Configuration

Ensure all environment variables are set correctly for the target environment.

### Cloud Build

The project includes Cloud Build configurations:
- `cloud_build.yaml` - Production build
- `cloud_build_test_br.yaml` - Test environment build
- `cloud_build_br.yaml` - Brazil environment build

## Contributing

1. Follow the coding standards defined in `.cursorrules`
2. Write tests for new features
3. Update documentation
4. Run linting and formatting before committing
5. Follow conventional commit messages

## Additional Documentation

All documentation is located in the `docs/` folder:

- [Improvements List](docs/IMPROVEMENTS.md) - Potential improvements
- [Testing Guide](docs/testing.md) - Testing documentation
- [Module Documentation](docs/modules/) - Detailed module docs
- [Quick Reference](docs/QUICK_REFERENCE.md) - Quick lookup guide
- [Setup Summary](docs/SETUP_SUMMARY.md) - Setup and configuration summary
- [Logging System](docs/LOGGING_SYSTEM.md) - Logging documentation
- [Cursor Rules](.cursorrules) - AI assistant guidelines

## License

UNLICENSED
