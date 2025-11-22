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
import { User } from 'src/auth/user.decorator';

import { Module } from './module.entity';
import { ModuleService } from './module.service';

@ApiTags('module')
@Controller('module')
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get module by ID',
    description: 'Retrieves a module by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Module ID', example: 'module-123' })
  @ApiResponse({ status: 200, description: 'Module found', type: Module })
  @ApiResponse({ status: 404, description: 'Module not found' })
  public async getModuleById(@Param() params: any): Promise<Module> {
    const { id } = params;
    return this.moduleService.getModuleById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({ summary: 'Get all modules', description: 'Retrieves a list of all modules' })
  @ApiResponse({ status: 200, description: 'List of modules', type: [Module] })
  public async getAllModule(): Promise<Module[]> {
    return this.moduleService.getAllModule();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId')
  @ApiOperation({
    summary: 'Get modules by commerce ID',
    description: 'Retrieves all modules for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of modules', type: [Module] })
  public async getModulesByCommerceId(@Param() params: any): Promise<Module[]> {
    const { commerceId } = params;
    return this.moduleService.getModulesByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/active')
  @ApiOperation({
    summary: 'Get active modules by commerce ID',
    description: 'Retrieves all active modules for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of active modules', type: [Module] })
  public async getActiveModulesByCommerceId(@Param() params: any): Promise<Module[]> {
    const { commerceId } = params;
    return this.moduleService.getActiveModulesByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new module',
    description: 'Creates a new module for a commerce',
  })
  @ApiBody({ type: Module })
  @ApiResponse({ status: 201, description: 'Module created successfully', type: Module })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createModule(@User() user, @Body() body: Module): Promise<Module> {
    const { commerceId, name } = body;
    return this.moduleService.createModule(user, commerceId, name);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update module configurations',
    description: 'Updates module configuration and status',
  })
  @ApiParam({ name: 'id', description: 'Module ID', example: 'module-123' })
  @ApiBody({ type: Module })
  @ApiResponse({ status: 200, description: 'Module updated successfully', type: Module })
  @ApiResponse({ status: 404, description: 'Module not found' })
  public async updateModuleConfigurations(
    @User() user,
    @Param() params: any,
    @Body() body: Module
  ): Promise<Module> {
    const { id } = params;
    const { name, active, available } = body;
    return this.moduleService.updateModuleConfigurations(user, id, name, active, available);
  }
}
