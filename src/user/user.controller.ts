import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

import { User } from './model/user.entity';
import { UserService } from './user.service';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieves a user by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'User ID', example: 'user-123' })
  @ApiResponse({ status: 200, description: 'User found', type: User })
  @ApiResponse({ status: 404, description: 'User not found' })
  public async getUserById(@Param() params: any): Promise<User> {
    const { id } = params;
    return this.userService.getUserById(id);
  }

  @Get('/')
  @ApiOperation({ summary: 'Get all users', description: 'Retrieves a list of all users' })
  @ApiResponse({ status: 200, description: 'List of users', type: [User] })
  public async getUsers(): Promise<User[]> {
    return this.userService.getUsers();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user', description: 'Creates a new user account' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'John' },
        phone: { type: 'string', example: '+56912345678' },
        email: { type: 'string', example: 'john@example.com' },
        commerceId: { type: 'string', example: 'commerce-123' },
        queueId: { type: 'string', example: 'queue-123' },
        personalInfo: { type: 'object' },
        acceptTermsAndConditions: { type: 'boolean', example: true },
      },
      required: ['name', 'phone', 'commerceId', 'acceptTermsAndConditions'],
    },
  })
  @ApiResponse({ status: 201, description: 'User created successfully', type: User })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createUser(@Body() body: any): Promise<User> {
    const { name, phone, email, commerceId, queueId, personalInfo, acceptTermsAndConditions } =
      body;
    return this.userService.createUser(
      name,
      phone,
      email,
      commerceId,
      queueId,
      personalInfo,
      undefined,
      acceptTermsAndConditions
    );
  }
}
