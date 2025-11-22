import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Patch,
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

import { Rol } from './model/rol.entity';
import { RolService } from './rol.service';

@ApiTags('rol')
@Controller('rol')
export class RolController {
  constructor(private readonly rolService: RolService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({ summary: 'Get all roles', description: 'Retrieves a list of all roles' })
  @ApiResponse({ status: 200, description: 'List of roles', type: [Rol] })
  public async getRoles(): Promise<Rol[]> {
    return this.rolService.getRoles();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get role by ID',
    description: 'Retrieves a role by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Role ID', example: 'rol-123' })
  @ApiResponse({ status: 200, description: 'Role found', type: Rol })
  @ApiResponse({ status: 404, description: 'Role not found' })
  public async getRolById(@Param() params: any): Promise<Rol> {
    const { id } = params;
    return this.rolService.getRolById(id);
  }

  @Get('/name/:name')
  @ApiOperation({ summary: 'Get role by name', description: 'Retrieves a role by its name' })
  @ApiParam({ name: 'name', description: 'Role name', example: 'admin' })
  @ApiResponse({ status: 200, description: 'Role found', type: Rol })
  public async getRolByName(@Param() params: any): Promise<Rol> {
    const { name } = params;
    return this.rolService.getRolByName(name);
  }

  @Post('/init')
  @ApiOperation({
    summary: 'Initialize roles',
    description: 'Initializes default roles in the system',
  })
  @ApiResponse({ status: 201, description: 'Roles initialized successfully', type: [Rol] })
  public async initRol(@User() user): Promise<Rol[]> {
    return this.rolService.initRol(user);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new role',
    description: 'Creates a new role with specified permissions',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'manager' },
        description: { type: 'string', example: 'Manager role' },
        permissions: { type: 'array', items: { type: 'string' } },
      },
      required: ['name'],
    },
  })
  @ApiResponse({ status: 201, description: 'Role created successfully', type: Rol })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createRol(@User() user, @Body() body: any): Promise<Rol> {
    const { name, description, permissions } = body;
    return this.rolService.createRol(user, name, description, permissions);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/permission')
  @ApiOperation({
    summary: 'Update role permission',
    description: 'Updates a specific permission for a role',
  })
  @ApiParam({ name: 'id', description: 'Role ID', example: 'rol-123' })
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
  @ApiResponse({ status: 200, description: 'Permission updated successfully', type: Rol })
  @ApiResponse({ status: 404, description: 'Role not found' })
  public async updateRolPermission(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Rol> {
    const { id } = params;
    const { name, value } = body;
    return this.rolService.updateRolPermission(user, id, name, value);
  }
}
