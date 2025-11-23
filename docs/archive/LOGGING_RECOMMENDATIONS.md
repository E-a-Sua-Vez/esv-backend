# Logging System Recommendations

## Current Implementation Status

✅ **Core logging infrastructure is complete and working**

The following has been implemented:
- GCP-compatible structured JSON logger
- Automatic request/response logging interceptor
- Enhanced error logging in exception filter
- Security event logging in auth guard
- All console.log/console.error replaced

## Recommendations for Standardization

### 1. Gradual Service Migration (Recommended)

**Priority**: Medium
**Effort**: Low per service

Migrate services gradually to use `GcpLoggerService` instead of NestJS Logger or console methods.

**Pattern to follow:**

```typescript
// Before
import { Logger } from '@nestjs/common';
private readonly logger = new Logger(ServiceName.name);

// After
import { GcpLoggerService } from '../shared/logger/gcp-logger.service';
constructor(private readonly logger: GcpLoggerService) {
  this.logger.setContext('ServiceName');
}
```

**Benefits:**
- Consistent log format
- Better observability
- GCP Cloud Logging integration
- Structured data in logs

### 2. Add Business Event Logging

**Priority**: High
**Effort**: Medium

Log important business events for analytics and debugging:

```typescript
// Booking created
this.logger.info('Booking created', {
  bookingId: booking.id,
  queueId: booking.queueId,
  userId: booking.userId,
  status: booking.status,
});

// Payment processed
this.logger.info('Payment processed', {
  paymentId: payment.id,
  amount: payment.amount,
  method: payment.method,
  businessId: payment.businessId,
});
```

**Key Events to Log:**
- Booking lifecycle (created, confirmed, cancelled)
- Payment processing
- User authentication
- Important state changes
- External API calls

### 3. Add Performance Logging

**Priority**: Medium
**Effort**: Low

Log slow operations for performance monitoring:

```typescript
const startTime = Date.now();
// ... operation ...
const duration = Date.now() - startTime;

if (duration > 1000) { // Log if > 1 second
  this.logger.warn('Slow operation detected', {
    operation: 'methodName',
    duration: `${duration}ms`,
    threshold: '1000ms',
  });
}
```

### 4. Standardize Error Logging

**Priority**: High
**Effort**: Medium

Ensure all services log errors consistently:

```typescript
try {
  // operation
} catch (error) {
  this.logger.logError(error, request, {
    operation: 'methodName',
    inputParams: { param1, param2 },
    context: 'additional context',
  });
  throw error; // Re-throw to maintain error flow
}
```

### 5. Add Correlation IDs

**Priority**: Low (Future Enhancement)
**Effort**: Medium

Add correlation IDs to track requests across services:

```typescript
// In interceptor or middleware
const correlationId = request.headers['x-correlation-id'] || generateId();
request['correlationId'] = correlationId;

// In logs
this.logger.info('Operation', {
  correlationId: request['correlationId'],
  // ... other data
});
```

### 6. Configure Log Levels by Environment

**Priority**: Low
**Effort**: Low

Currently all log levels are enabled. Consider:

- **Local**: DEBUG, INFO, WARNING, ERROR
- **Test**: INFO, WARNING, ERROR
- **Production**: WARNING, ERROR, CRITICAL

This can be configured in the logger service.

### 7. Add Log Retention Policies

**Priority**: Low (GCP Configuration)
**Effort**: Low

Configure log retention in GCP Cloud Logging:
- Error logs: 90 days
- Info logs: 30 days
- Debug logs: 7 days

### 8. Set Up Alerts

**Priority**: Medium (GCP Configuration)
**Effort**: Low

Create alerts in GCP for:
- ERROR and CRITICAL logs
- High error rate
- Authentication failures
- Slow requests (> threshold)

## Migration Checklist

For each service module:

- [ ] Inject `GcpLoggerService` in constructor
- [ ] Set context in constructor
- [ ] Replace `Logger` with `GcpLoggerService`
- [ ] Replace `console.log/error` with logger methods
- [ ] Add error logging in catch blocks
- [ ] Add business event logging
- [ ] Test logging output
- [ ] Verify logs appear in GCP (if deployed)

## Priority Services for Migration

1. **BookingService** - Core business logic, many operations
2. **AttentionService** - Core business logic, many operations
3. **PaymentService** - Financial operations, critical
4. **NotificationService** - External integrations
5. **ClientService** - User-facing operations

## Testing Logging

### Local Testing

```bash
npm run start:local
# Check console output for structured JSON logs
```

### GCP Testing

1. Deploy to GCP environment
2. Make API requests
3. Check Cloud Logging console
4. Verify logs are structured correctly
5. Test log queries

### Log Query Examples

```
# All errors
severity>=ERROR

# Errors in BookingService
severity>=ERROR
jsonPayload.context="BookingService"

# Slow requests (>1s)
jsonPayload.duration=~"1[0-9]{3,}ms"

# Authentication failures
jsonPayload.securityEvent="AUTH_FAILED"
```

## Best Practices Summary

1. ✅ **Always inject logger** - Don't create new instances
2. ✅ **Set context early** - In constructor
3. ✅ **Use appropriate levels** - DEBUG for dev, INFO for normal, ERROR for errors
4. ✅ **Include context** - Always include IDs, parameters
5. ✅ **Log errors before throwing** - Always log before re-throwing
6. ✅ **Don't log sensitive data** - Logger sanitizes automatically
7. ✅ **Use structured data** - Pass objects, not strings
8. ✅ **Log business events** - Important state changes

## Current Status

- ✅ Core logging infrastructure complete
- ✅ Request/response logging automatic
- ✅ Error logging enhanced
- ✅ Security event logging
- ⏳ Service migration (gradual, recommended)
- ⏳ Business event logging (recommended)
- ⏳ Performance logging (optional)

## Next Steps

1. **Immediate**: System is ready to use, all infrastructure in place
2. **Short-term**: Migrate high-priority services (Booking, Attention, Payment)
3. **Medium-term**: Add business event logging across all services
4. **Long-term**: Add correlation IDs, configure alerts, optimize retention

## Support

For questions or issues:
- See `docs/LOGGING_SYSTEM.md` for detailed documentation
- See `docs/LOGGING_IMPROVEMENTS.md` for implementation details
- Check GCP Cloud Logging documentation for advanced queries

