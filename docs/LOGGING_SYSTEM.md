# Logging System Documentation

## Overview

The ESV Backend uses a GCP-compatible structured logging system that outputs JSON logs compatible with Google Cloud Logging. This ensures all logs are properly formatted, searchable, and traceable in GCP environments.

## Architecture

### Components

1. **GcpLoggerService** (`src/shared/logger/gcp-logger.service.ts`)
   - Core logging service that implements NestJS `LoggerService` interface
   - Outputs structured JSON logs compatible with GCP Cloud Logging
   - Supports all standard log levels: DEBUG, INFO, NOTICE, WARNING, ERROR, CRITICAL

2. **LoggingInterceptor** (`src/shared/logger/logging.interceptor.ts`)
   - Automatically logs all HTTP requests and responses
   - Captures request/response metadata
   - Sanitizes sensitive information (passwords, tokens, etc.)

3. **HttpExceptionFilter** (`src/shared/filters/http-exception.filter.ts`)
   - Enhanced with GCP-compatible error logging
   - Logs all exceptions with full context
   - Maintains error sanitization for frontend compatibility

## GCP Cloud Logging Compatibility

### Log Format

All logs are output as structured JSON with the following format:

```json
{
  "severity": "INFO|WARNING|ERROR|DEBUG|CRITICAL",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "message": "Log message",
  "context": "ServiceName",
  "environment": "local|test|prod",
  "service": "esv-backend",
  "httpRequest": {
    "requestMethod": "GET",
    "requestUrl": "/api/booking",
    "requestSize": "1024",
    "userAgent": "Mozilla/5.0...",
    "remoteIp": "192.168.1.1",
    "referer": "https://example.com"
  },
  "user": "user@example.com",
  "userId": "user-123",
  "logging.googleapis.com/trace": "projects/PROJECT_ID/traces/TRACE_ID"
}
```

### Severity Levels

- **DEBUG**: Detailed information for debugging
- **INFO**: General informational messages
- **NOTICE**: Normal but significant events
- **WARNING**: Warning messages (e.g., auth failures, validation issues)
- **ERROR**: Error events that need attention
- **CRITICAL**: Critical errors requiring immediate attention

### Trace Context

The logger automatically captures GCP trace context from the `x-cloud-trace-context` header, enabling distributed tracing across services.

## Usage

### In Services

```typescript
import { Injectable } from '@nestjs/common';
import { GcpLoggerService } from '../shared/logger/gcp-logger.service';

@Injectable()
export class BookingService {
  private readonly logger: GcpLoggerService;

  constructor(logger: GcpLoggerService) {
    this.logger = logger;
    this.logger.setContext('BookingService');
  }

  public async createBooking(...): Promise<Booking> {
    try {
      this.logger.info('Creating booking', { queueId, date });

      // Business logic...

      this.logger.info('Booking created successfully', { bookingId: booking.id });
      return booking;
    } catch (error) {
      this.logger.logError(error, undefined, {
        operation: 'createBooking',
        queueId,
        date,
      });
      throw error;
    }
  }
}
```

### In Controllers

Controllers automatically log via the `LoggingInterceptor`. For additional logging:

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { GcpLoggerService } from '../shared/logger/gcp-logger.service';

@Controller('booking')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly logger: GcpLoggerService,
  ) {
    this.logger.setContext('BookingController');
  }

  @Post()
  public async createBooking(@Body() body: CreateBookingDto, @Req() request: Request) {
    this.logger.logWithRequest('INFO', 'Creating booking via API', request, {
      queueId: body.queueId,
    });

    return this.bookingService.createBooking(...);
  }
}
```

### Logging with Request Context

```typescript
// Log with full HTTP request context
this.logger.logWithRequest(
  'INFO',
  'Operation completed',
  request,
  {
    additionalData: 'value',
  }
);
```

### Logging Errors

```typescript
// Log error with full context
this.logger.logError(
  error,
  request, // Optional: include request for HTTP context
  {
    operation: 'methodName',
    additionalContext: 'value',
  }
);
```

## Standardization Guidelines

### 1. Always Set Context

```typescript
constructor(logger: GcpLoggerService) {
  this.logger = logger;
  this.logger.setContext('ServiceName'); // Always set context
}
```

### 2. Use Appropriate Log Levels

- **DEBUG**: Detailed debugging information (only in local/dev)
- **INFO**: Normal operations, successful operations
- **WARNING**: Recoverable errors, validation failures, auth issues
- **ERROR**: Errors that need attention but don't crash the app
- **CRITICAL**: Critical errors requiring immediate action

### 3. Include Relevant Context

Always include relevant context in logs:

```typescript
// Good
this.logger.info('Booking created', {
  bookingId: booking.id,
  queueId: booking.queueId,
  userId: booking.userId,
});

// Bad
this.logger.info('Booking created'); // No context
```

### 4. Log Errors with Full Context

```typescript
try {
  // operation
} catch (error) {
  this.logger.logError(error, request, {
    operation: 'methodName',
    inputParams: { param1, param2 },
  });
  throw error;
}
```

### 5. Don't Log Sensitive Information

The logger automatically sanitizes:
- Passwords
- Tokens
- Authorization headers
- Secrets
- Keys

But be careful with:
- Email addresses (can be logged, but consider GDPR)
- Personal information
- Payment information

## Error Handling Pattern

### Standard Service Method Pattern

```typescript
public async methodName(params: Type): Promise<ReturnType> {
  this.logger.debug('Method called', { params });

  try {
    // 1. Validate inputs
    this.logger.debug('Validating inputs');

    // 2. Fetch related data
    this.logger.debug('Fetching related data', { id });

    // 3. Business logic
    this.logger.info('Processing business logic');

    // 4. Save/update
    const result = await this.repository.create(entity);
    this.logger.info('Entity created', { id: result.id });

    // 5. Publish events
    this.logger.debug('Publishing event');

    // 6. Return result
    return result;
  } catch (error) {
    this.logger.logError(error, undefined, {
      operation: 'methodName',
      params,
    });
    throw new HttpException(
      `Error message: ${error.message}`,
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
```

## Migration Guide

### Replacing console.log

**Before:**
```typescript
console.log('Booking created:', bookingId);
```

**After:**
```typescript
this.logger.info('Booking created', { bookingId });
```

### Replacing console.error

**Before:**
```typescript
console.error('Error:', error);
```

**After:**
```typescript
this.logger.logError(error, request, { operation: 'methodName' });
```

### Replacing NestJS Logger

**Before:**
```typescript
private readonly logger = new Logger(ServiceName.name);
this.logger.log('Message');
this.logger.error('Error', trace);
```

**After:**
```typescript
constructor(private readonly logger: GcpLoggerService) {
  this.logger.setContext('ServiceName');
}
this.logger.info('Message');
this.logger.logError(error, request);
```

## GCP Integration

### Cloud Logging

When deployed to GCP, logs are automatically captured by Cloud Logging if:
1. Application is running in a GCP environment (Cloud Run, GKE, Compute Engine)
2. Logs are written to stdout/stderr (which our logger does)
3. Proper IAM permissions are configured

### Log Queries

In GCP Cloud Logging, you can query logs using:

```
severity>=ERROR
resource.type="cloud_run_revision"
jsonPayload.service="esv-backend"
jsonPayload.context="BookingService"
```

### Trace Correlation

Logs automatically include trace context when the `x-cloud-trace-context` header is present, enabling correlation across services in distributed systems.

## Testing

The logger works seamlessly in tests. In test environments, logs are still output but can be suppressed if needed:

```typescript
// In test setup
if (process.env.NODE_ENV === 'test') {
  // Logger will still work but can be configured to be less verbose
}
```

## Best Practices

1. **Always inject logger via constructor** - Don't create new instances
2. **Set context early** - In constructor, not in each method
3. **Use appropriate log levels** - Don't log everything as ERROR
4. **Include context** - Always include relevant IDs, parameters, etc.
5. **Log errors before throwing** - Always log errors before re-throwing
6. **Don't log sensitive data** - Logger sanitizes automatically, but be mindful
7. **Use structured data** - Pass objects, not concatenated strings
8. **Log important business events** - Booking created, payment processed, etc.

## Examples

### Service with Logging

```typescript
@Injectable()
export class BookingService {
  private readonly logger: GcpLoggerService;

  constructor(
    @InjectRepository(Booking)
    private bookingRepository = getRepository(Booking),
    logger: GcpLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext('BookingService');
  }

  public async getBookingById(id: string): Promise<Booking> {
    this.logger.debug('Fetching booking', { id });

    try {
      const booking = await this.bookingRepository.findById(id);

      if (!booking) {
        this.logger.warn('Booking not found', { id });
        throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
      }

      this.logger.info('Booking retrieved', { id, status: booking.status });
      return booking;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.logError(error, undefined, {
        operation: 'getBookingById',
        id,
      });
      throw new HttpException(
        'Error retrieving booking',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
```

## Configuration

### Environment Variables

- `NODE_ENV`: Controls log formatting (local = pretty, prod = compact JSON)
- `PROJECT_ID`: Used for trace context in GCP

### Log Levels

Currently, all log levels are enabled. To filter by level in production, configure at the GCP Cloud Logging level using log queries.

## Troubleshooting

### Logs not appearing in GCP

1. Check that application is running in GCP environment
2. Verify logs are going to stdout/stderr
3. Check IAM permissions for Cloud Logging
4. Verify PROJECT_ID environment variable is set

### Logs too verbose

- Use appropriate log levels (DEBUG only in development)
- Filter logs in GCP Cloud Logging console
- Adjust log levels per service if needed

### Missing trace context

- Ensure `x-cloud-trace-context` header is present in requests
- Verify PROJECT_ID is set correctly
- Check that GCP trace context propagation is configured

