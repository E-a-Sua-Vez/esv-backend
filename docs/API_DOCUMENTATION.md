# API Documentation

This document provides information about the API documentation setup and how to use it.

## Swagger/OpenAPI Documentation

The API is documented using Swagger/OpenAPI 3.0. Once the server is running, you can access the interactive API documentation at:

**URL**: `http://localhost:3000/api-docs`

### Features

- Interactive API explorer
- Try out endpoints directly from the browser
- Authentication support (JWT Bearer token)
- Request/response examples
- Schema definitions

### Authentication

Most endpoints require JWT authentication. To use the Swagger UI:

1. Click the "Authorize" button at the top right
2. Enter your JWT token in the format: `Bearer <your-token>`
3. Click "Authorize" and "Close"
4. All authenticated requests will now include the token

## Postman Collection

A Postman collection is automatically generated from the OpenAPI specification.

### Generating the Collection

1. Start the server with Swagger JSON generation enabled:
   ```bash
   GENERATE_SWAGGER_JSON=true npm run start:local
   ```

2. Generate the Postman collection:
   ```bash
   npm run postman:generate
   ```

3. The collection will be saved to: `docs/postman-collection.json`

### Importing into Postman

1. Open Postman
2. Click "Import" button
3. Select the file: `docs/postman-collection.json`
4. The collection will be imported with all endpoints organized by tags

### Using the Collection

1. Set the `base_url` variable to your server URL (default: `http://localhost:3000`)
2. Set the `jwt_token` variable with your authentication token
3. All requests will automatically use these variables

## API Endpoints

The API is organized into the following modules:

### Core Modules

- **Booking** (`/booking`) - Appointment booking management
- **Commerce** (`/commerce`) - Commerce/location management
- **Queue** (`/queue`) - Queue management
- **User** (`/user`) - User management
- **Client** (`/client`) - Client management
- **Attention** (`/attention`) - Service attention management
- **Waitlist** (`/waitlist`) - Waitlist management

### Supporting Modules

- **Business** (`/business`) - Business management
- **Service** (`/service`) - Service management
- **Payment** (`/payment`) - Payment processing
- **Plan** (`/plan`) - Subscription plan management
- **Survey** (`/survey`) - Survey management
- **Notification** (`/notification`) - Notification management
- **Health** (`/health`) - Health check endpoint

### Other Modules

- Administrator, Collaborator, Partner
- Feature Toggle, Module, Permission, Role
- Form, Form Personalized
- Income, Outcome, Outcome Type
- Package, Product
- Patient History, Patient History Item
- Plan Activation
- Survey Personalized
- Suggestion
- Documents
- Block
- Company
- Message

## API Versioning

The API uses URI versioning. All endpoints are prefixed with `/v1/` (or the configured version).

## Response Formats

### Success Responses

- `200 OK` - Successful GET, PATCH requests
- `201 Created` - Successful POST requests

### Error Responses

- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate, already taken)
- `500 Internal Server Error` - Server error

### Error Response Format

```json
{
  "statusCode": 400,
  "timestamp": "2024-01-15T10:00:00.000Z",
  "path": "/api/v1/booking",
  "method": "POST",
  "message": "Error message here"
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:
- Default: 100 requests per 60 seconds per IP
- Configurable via environment variables:
  - `THROTTLE_TTL` - Time window in seconds (default: 60)
  - `THROTTLE_LIMIT` - Maximum requests per window (default: 100)

## Request Size Limits

- Maximum request body size: 5MB (configurable via `MAX_REQUEST_SIZE`)

## Security Headers

The API includes the following security headers:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` (in production)

## CORS

CORS is configured based on the environment:
- **Local**: `http://localhost:5173`
- **Test/Prod**: Configured list of allowed origins

## Examples

### Creating a Booking

```bash
curl -X POST http://localhost:3000/api/v1/booking \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "queueId": "queue-123",
    "date": "2024-01-15",
    "user": {
      "name": "John",
      "phone": "+56912345678",
      "email": "john@example.com",
      "acceptTermsAndConditions": true
    },
    "block": {
      "number": 1,
      "hourFrom": "09:00",
      "hourTo": "10:00"
    }
  }'
```

### Getting Commerce Details

```bash
curl -X GET http://localhost:3000/api/v1/commerce/commerce-123 \
  -H "Authorization: Bearer <your-token>"
```

## Documentation Updates

When adding new endpoints or modifying existing ones:

1. Add Swagger decorators to the controller
2. Create/update DTOs with `@ApiProperty` decorators
3. Regenerate the OpenAPI spec and Postman collection
4. Update this documentation if needed

## Additional Resources

- [Swagger Documentation](https://swagger.io/docs/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Postman Documentation](https://learning.postman.com/docs/)

