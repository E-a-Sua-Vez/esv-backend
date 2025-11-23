# Swagger/OpenAPI Setup Guide

This document provides information about the Swagger/OpenAPI setup and how to complete documentation for all controllers.

## Current Status

### Controllers with Swagger Decorators ✅

The following controllers have been fully documented with Swagger decorators:

1. **booking** - Booking management endpoints
2. **commerce** - Commerce management endpoints
3. **user** - User management endpoints
4. **queue** - Queue management endpoints
5. **client** - Client management endpoints
6. **attention** - Attention management endpoints
7. **waitlist** - Waitlist management endpoints
8. **business** - Business management endpoints
9. **notification** - Notification endpoints
10. **payment** - Payment processing endpoints
11. **service** - Service management endpoints
12. **survey** - Survey management endpoints
13. **health** - Health check endpoint

### Controllers Needing Swagger Decorators ⚠️

The following controllers still need Swagger decorators added:

1. **rol** - Role management
2. **feature-toggle** - Feature toggle management
3. **plan** - Plan management
4. **administrator** - Administrator management
5. **collaborator** - Collaborator management
6. **partner** - Partner management
7. **feature** - Feature management
8. **module** - Module management
9. **permission** - Permission management
10. **form** - Form management
11. **form-personalized** - Personalized form management
12. **income** - Income management
13. **outcome** - Outcome management
14. **outcome-type** - Outcome type management
15. **package** - Package management
16. **product** - Product management
17. **patient-history** - Patient history management
18. **patient-history-item** - Patient history item management
19. **plan-activation** - Plan activation management
20. **survey-personalized** - Personalized survey management
21. **suggestion** - Suggestion management
22. **documents** - Document management
23. **block** - Block management
24. **company** - Company management
25. **message** - Message management

## How to Add Swagger Decorators

### Step 1: Import Swagger Decorators

Add these imports to your controller:

```typescript
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { HttpCode, HttpStatus } from '@nestjs/common';
```

### Step 2: Add Controller Tag

Add the `@ApiTags` decorator to the controller class:

```typescript
@ApiTags('controller-name')
@Controller('controller-name')
export class ControllerName {
  // ...
}
```

### Step 3: Add Method Decorators

For each endpoint method, add appropriate decorators:

#### GET Endpoint Example

```typescript
@UseGuards(AuthGuard)
@ApiBearerAuth('JWT-auth')
@Get('/:id')
@ApiOperation({
  summary: 'Get resource by ID',
  description: 'Retrieves a resource by its unique identifier'
})
@ApiParam({ name: 'id', description: 'Resource ID', example: 'resource-123' })
@ApiResponse({ status: 200, description: 'Resource found', type: ResourceEntity })
@ApiResponse({ status: 404, description: 'Resource not found' })
public async getResourceById(@Param() params: any): Promise<ResourceEntity> {
  // ...
}
```

#### POST Endpoint Example

```typescript
@UseGuards(AuthGuard)
@ApiBearerAuth('JWT-auth')
@Post()
@HttpCode(HttpStatus.CREATED)
@ApiOperation({
  summary: 'Create a new resource',
  description: 'Creates a new resource'
})
@ApiBody({ type: CreateResourceDto })
@ApiResponse({ status: 201, description: 'Resource created successfully', type: ResourceEntity })
@ApiResponse({ status: 400, description: 'Bad request' })
public async createResource(@Body() body: CreateResourceDto): Promise<ResourceEntity> {
  // ...
}
```

#### PATCH Endpoint Example

```typescript
@UseGuards(AuthGuard)
@ApiBearerAuth('JWT-auth')
@Patch('/:id')
@ApiOperation({
  summary: 'Update resource',
  description: 'Updates an existing resource'
})
@ApiParam({ name: 'id', description: 'Resource ID', example: 'resource-123' })
@ApiBody({ type: UpdateResourceDto })
@ApiResponse({ status: 200, description: 'Resource updated successfully', type: ResourceEntity })
@ApiResponse({ status: 404, description: 'Resource not found' })
public async updateResource(@Param() params: any, @Body() body: UpdateResourceDto): Promise<ResourceEntity> {
  // ...
}
```

### Step 4: Create DTOs with Swagger Decorators

For request/response DTOs, add `@ApiProperty` decorators:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateResourceDto {
  @ApiProperty({ description: 'Resource name', example: 'My Resource' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Resource description', example: 'A description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Resource value', example: 100 })
  @IsNumber()
  value: number;
}
```

### Step 5: Update main.ts Tags

Add the new tag to the Swagger configuration in `src/main.ts`:

```typescript
.addTag('controller-name', 'Controller description')
```

## Testing the Documentation

1. Start the server:
   ```bash
   npm run start:local
   ```

2. Access Swagger UI:
   ```
   http://localhost:3000/api-docs
   ```

3. Verify all endpoints are documented correctly

4. Test authentication:
   - Click "Authorize" button
   - Enter JWT token: `Bearer <your-token>`
   - Test authenticated endpoints

## Generating Postman Collection

1. Start server with JSON generation:
   ```bash
   GENERATE_SWAGGER_JSON=true npm run start:local
   ```

2. Generate Postman collection:
   ```bash
   npm run postman:generate
   ```

3. Import into Postman:
   - Open Postman
   - Click "Import"
   - Select `docs/postman-collection.json`

## Best Practices

1. **Always add descriptions**: Provide clear, concise descriptions for all operations
2. **Use examples**: Include example values in `@ApiProperty` decorators
3. **Document all responses**: Include success and error responses
4. **Use proper types**: Reference entity classes or DTOs in `@ApiResponse` and `@ApiBody`
5. **Group by tags**: Use consistent tag names that match the controller name
6. **Document authentication**: Add `@ApiBearerAuth` for protected endpoints
7. **Use HTTP status codes**: Use appropriate status codes in `@HttpCode` and `@ApiResponse`

## Common Patterns

### Pagination
```typescript
@ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
@ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
```

### Query Parameters
```typescript
@ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'] })
```

### File Upload
```typescript
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        format: 'binary',
      },
    },
  },
})
```

## Troubleshooting

### Swagger UI not loading
- Check that `@nestjs/swagger` is installed
- Verify SwaggerModule is configured in `main.ts`
- Check console for errors

### Endpoints not appearing
- Ensure `@ApiTags` is added to the controller
- Verify the controller is registered in a module
- Check that the module is imported in `app.module.ts`

### Authentication not working
- Verify `@ApiBearerAuth('JWT-auth')` is added
- Check that the security scheme name matches ('JWT-auth')
- Ensure the token format is correct: `Bearer <token>`

## Resources

- [NestJS Swagger Documentation](https://docs.nestjs.com/openapi/introduction)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger Decorators Reference](https://docs.nestjs.com/openapi/types-and-parameters)

