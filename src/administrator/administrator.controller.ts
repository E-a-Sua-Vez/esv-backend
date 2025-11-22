import {
  Controller,
  Get,
  Param,
  Body,
  Patch,
  UseGuards,
  Post,
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
import { User } from 'src/auth/user.decorator';

import { AdministratorService } from './administrator.service';
import { Administrator } from './model/administrator.entity';

@ApiTags('administrator')
@Controller('administrator')
export class AdministratorController {
  constructor(private readonly administratorService: AdministratorService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get administrator by ID',
    description: 'Retrieves an administrator by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Administrator ID', example: 'admin-123' })
  @ApiResponse({ status: 200, description: 'Administrator found', type: Administrator })
  @ApiResponse({ status: 404, description: 'Administrator not found' })
  public async getAdministratorById(@Param() params: any): Promise<Administrator> {
    const { id } = params;
    return this.administratorService.getAdministratorById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new administrator',
    description: 'Creates a new administrator account',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'John Doe' },
        businessId: { type: 'string', example: 'business-123' },
        commercesId: { type: 'array', items: { type: 'string' } },
        email: { type: 'string', example: 'admin@example.com' },
      },
      required: ['name', 'email', 'businessId'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Administrator created successfully',
    type: Administrator,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createAdministrator(@User() user, @Body() body: any): Promise<Administrator> {
    const { name, businessId, commercesId, email } = body;
    return this.administratorService.createAdministrator(
      user,
      name,
      businessId,
      commercesId,
      email
    );
  }

  @Get('/email/:email')
  @ApiOperation({
    summary: 'Get administrator by email',
    description: 'Retrieves an administrator by email address',
  })
  @ApiParam({ name: 'email', description: 'Administrator email', example: 'admin@example.com' })
  @ApiResponse({ status: 200, description: 'Administrator found', type: Administrator })
  public async getAdministratorByEmail(@Param() params: any): Promise<Administrator> {
    const { email } = params;
    return this.administratorService.getAdministratorByEmail(email);
  }

  @Get('/email/:email/master')
  @ApiOperation({
    summary: 'Get master administrator by email',
    description: 'Retrieves a master administrator by email address',
  })
  @ApiParam({ name: 'email', description: 'Administrator email', example: 'admin@example.com' })
  @ApiResponse({ status: 200, description: 'Master administrator found', type: Administrator })
  public async getMasterAdministratorByEmail(@Param() params: any): Promise<Administrator> {
    const { email } = params;
    return this.administratorService.getMasterAdministratorByEmail(email);
  }

  @Patch('/register-token/:id')
  public async registerToken(@Param() params: any, @Body() body: any): Promise<Administrator> {
    const { id } = params;
    const { token } = body;
    return this.administratorService.updateToken(id, token);
  }

  @Patch('/change-password/:id')
  public async changePassword(@Param() params: any): Promise<Administrator> {
    const { id } = params;
    return this.administratorService.changePassword(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/businessId/:businessId')
  @ApiOperation({
    summary: 'Get administrators by business ID',
    description: 'Retrieves all administrators for a specific business',
  })
  @ApiParam({ name: 'businessId', description: 'Business ID', example: 'business-123' })
  @ApiResponse({ status: 200, description: 'List of administrators', type: [Administrator] })
  public async getAdministratorsByBusinessId(@Param() params: any): Promise<Administrator[]> {
    const { businessId } = params;
    return this.administratorService.getAdministratorsByBusinessId(businessId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update administrator',
    description: 'Updates administrator information',
  })
  @ApiParam({ name: 'id', description: 'Administrator ID', example: 'admin-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        active: { type: 'boolean' },
        commercesId: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Administrator updated successfully',
    type: Administrator,
  })
  public async updateAdministrator(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Administrator> {
    const { id } = params;
    const { active, commercesId } = body;
    return this.administratorService.updateAdministrator(user, id, commercesId, active);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/permission')
  @ApiOperation({
    summary: 'Update administrator permission',
    description: 'Updates a specific permission for an administrator',
  })
  @ApiParam({ name: 'id', description: 'Administrator ID', example: 'admin-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'permission-name' },
        value: { type: 'boolean', example: true },
      },
      required: ['name', 'value'],
    },
  })
  @ApiResponse({ status: 200, description: 'Permission updated successfully', type: Administrator })
  public async updateAdministratorPermission(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Administrator> {
    const { id } = params;
    const { name, value } = body;
    return this.administratorService.updateAdministratorPermission(user, id, name, value);
  }
}
