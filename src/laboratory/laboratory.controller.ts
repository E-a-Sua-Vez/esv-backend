import { Controller, Get, Post, Put, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/user.decorator';

import { CreateLaboratoryDto } from './dto/create-laboratory.dto';
import { LaboratoryService } from './laboratory.service';
import { Laboratory } from './model/laboratory.entity';

@ApiTags('Laboratory')
@Controller('laboratory')
@UseGuards(AuthGuard)
@ApiBearerAuth('JWT-auth')
export class LaboratoryController {
  constructor(private readonly laboratoryService: LaboratoryService) {}

  @Post()
  @ApiOperation({ summary: 'Create laboratory' })
  @ApiResponse({ status: 201, description: 'Laboratory created', type: Laboratory })
  async createLaboratory(
    @User() user: string,
    @Body() dto: CreateLaboratoryDto
  ): Promise<Laboratory> {
    return this.laboratoryService.createLaboratory(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List laboratories' })
  @ApiResponse({ status: 200, description: 'List of laboratories', type: [Laboratory] })
  async listLaboratories(
    @Query('commerceId') commerceId?: string,
    @Query('businessId') businessId?: string,
    @Query('activeOnly') activeOnly?: string
  ): Promise<Laboratory[]> {
    return this.laboratoryService.listLaboratories(commerceId, businessId, activeOnly !== 'false');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get laboratory by ID' })
  @ApiResponse({ status: 200, description: 'Laboratory found', type: Laboratory })
  async getLaboratoryById(@Param('id') id: string): Promise<Laboratory> {
    return this.laboratoryService.getLaboratoryById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update laboratory' })
  @ApiResponse({ status: 200, description: 'Laboratory updated', type: Laboratory })
  async updateLaboratory(
    @User() user: string,
    @Param('id') id: string,
    @Body() updates: Partial<CreateLaboratoryDto>
  ): Promise<Laboratory> {
    return this.laboratoryService.updateLaboratory(user, id, updates);
  }
}
