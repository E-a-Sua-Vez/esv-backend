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

import { PatientHistoryItem } from './model/patient-history-item.entity';
import { PatientHistoryItemService } from './patient-history-item.service';

@ApiTags('patient-history-item')
@Controller('patient-history-item')
export class PatientHistoryItemController {
  constructor(private readonly patientHistoryItemService: PatientHistoryItemService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get patient history item by ID',
    description: 'Retrieves a patient history item by its unique identifier',
  })
  @ApiParam({
    name: 'id',
    description: 'Patient history item ID',
    example: 'patient-history-item-123',
  })
  @ApiResponse({ status: 200, description: 'Patient history item found', type: PatientHistoryItem })
  @ApiResponse({ status: 404, description: 'Patient history item not found' })
  public async getPatientHistoryItemById(@Param() params: any): Promise<PatientHistoryItem> {
    const { id } = params;
    return this.patientHistoryItemService.getPatientHistoryItemById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({
    summary: 'Get all patient history items',
    description: 'Retrieves a list of all patient history items',
  })
  @ApiResponse({
    status: 200,
    description: 'List of patient history items',
    type: [PatientHistoryItem],
  })
  public async getAllPatientHistoryItem(): Promise<PatientHistoryItem[]> {
    return this.patientHistoryItemService.getAllPatientHistoryItem();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId')
  @ApiOperation({
    summary: 'Get patient history items by commerce',
    description: 'Retrieves all patient history items for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({
    status: 200,
    description: 'List of patient history items',
    type: [PatientHistoryItem],
  })
  public async getPatientHistoryItemsByCommerceId(
    @Param() params: any
  ): Promise<PatientHistoryItem[]> {
    const { commerceId } = params;
    return this.patientHistoryItemService.getPatientHistoryItemsByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/active')
  @ApiOperation({
    summary: 'Get active patient history items by commerce',
    description: 'Retrieves all active patient history items for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({
    status: 200,
    description: 'List of active patient history items',
    type: [PatientHistoryItem],
  })
  public async getActivePatientHistoryItemsByCommerceId(
    @Param() params: any
  ): Promise<PatientHistoryItem[]> {
    const { commerceId } = params;
    return this.patientHistoryItemService.getActivePatientHistoryItemsByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/type/:type')
  @ApiOperation({
    summary: 'Get active patient history items by commerce and type',
    description: 'Retrieves active patient history items filtered by commerce and type',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'type', description: 'Item type', example: 'SYMPTOM' })
  @ApiResponse({
    status: 200,
    description: 'List of active patient history items',
    type: [PatientHistoryItem],
  })
  public async getActivePatientHistoryItemsByCommerceIdAndType(
    @Param() params: any
  ): Promise<PatientHistoryItem[]> {
    const { commerceId, type } = params;
    return this.patientHistoryItemService.getActivePatientHistoryItemsByCommerceIdAndType(
      commerceId,
      type
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new patient history item',
    description: 'Creates a new patient history item definition',
  })
  @ApiBody({ type: PatientHistoryItem })
  @ApiResponse({
    status: 201,
    description: 'Patient history item created successfully',
    type: PatientHistoryItem,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createPatientHistoryItem(
    @User() user,
    @Body() body: PatientHistoryItem
  ): Promise<PatientHistoryItem> {
    const { commerceId, name, tag, order, type, characteristics } = body;
    return this.patientHistoryItemService.createPatientHistoryItem(
      user,
      commerceId,
      name,
      tag,
      order,
      type,
      characteristics
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update patient history item configurations',
    description: 'Updates patient history item configuration and status',
  })
  @ApiParam({
    name: 'id',
    description: 'Patient history item ID',
    example: 'patient-history-item-123',
  })
  @ApiBody({ type: PatientHistoryItem })
  @ApiResponse({
    status: 200,
    description: 'Patient history item updated successfully',
    type: PatientHistoryItem,
  })
  @ApiResponse({ status: 404, description: 'Patient history item not found' })
  public async updatePatientHistoryItemConfigurations(
    @User() user,
    @Param() params: any,
    @Body() body: PatientHistoryItem
  ): Promise<PatientHistoryItem> {
    const { id } = params;
    const { name, active, available, type, characteristics, tag, order, online } = body;
    return this.patientHistoryItemService.updatePatientHistoryItemConfigurations(
      user,
      id,
      name,
      tag,
      order,
      type,
      characteristics,
      active,
      available,
      online
    );
  }
}
