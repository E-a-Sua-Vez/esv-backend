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

import { PatientHistoryUpdateDto } from './dto/patient-history-update.dto';
import { PatientHistory } from './model/patient-history.entity';
import { PatientHistoryService } from './patient-history.service';

@ApiTags('patient-history')
@Controller('patient-history')
export class PatientHistoryController {
  constructor(private readonly patientHistoryService: PatientHistoryService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get patient history by ID',
    description: 'Retrieves a patient history record by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Patient history ID', example: 'patient-history-123' })
  @ApiResponse({ status: 200, description: 'Patient history found', type: PatientHistory })
  @ApiResponse({ status: 404, description: 'Patient history not found' })
  public async getPatientHistoryById(@Param() params: any): Promise<PatientHistory> {
    const { id } = params;
    return this.patientHistoryService.getPatientHistoryById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({
    summary: 'Get all patient histories',
    description: 'Retrieves a list of all patient history records',
  })
  @ApiResponse({ status: 200, description: 'List of patient histories', type: [PatientHistory] })
  public async getAllPatientHistory(): Promise<PatientHistory[]> {
    return this.patientHistoryService.getAllPatientHistory();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId')
  @ApiOperation({
    summary: 'Get patient histories by commerce',
    description: 'Retrieves all patient histories for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of patient histories', type: [PatientHistory] })
  public async getPatientHistorysByCommerceId(@Param() params: any): Promise<PatientHistory[]> {
    const { commerceId } = params;
    return this.patientHistoryService.getPatientHistorysByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/active')
  @ApiOperation({
    summary: 'Get active patient histories by commerce',
    description: 'Retrieves all active patient histories for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({
    status: 200,
    description: 'List of active patient histories',
    type: [PatientHistory],
  })
  public async getActivePatientHistorysByCommerceId(
    @Param() params: any
  ): Promise<PatientHistory[]> {
    const { commerceId } = params;
    return this.patientHistoryService.getActivePatientHistorysByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new patient history',
    description: 'Creates a new patient medical history record',
  })
  @ApiBody({ type: PatientHistory })
  @ApiResponse({
    status: 201,
    description: 'Patient history created successfully',
    type: PatientHistory,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createPatientHistory(
    @User() user,
    @Body() body: PatientHistory
  ): Promise<PatientHistory> {
    const {
      commerceId,
      clientId,
      type,
      personalData,
      consultationReason,
      currentIllness,
      patientAnamnese,
      functionalExam,
      physicalExam,
      diagnostic,
      medicalOrder,
      control,
      aditionalInfo,
      lastAttentionId,
      patientDocument,
    } = body;
    return this.patientHistoryService.createPatientHistory(
      user,
      commerceId,
      clientId,
      type,
      personalData,
      consultationReason,
      currentIllness,
      patientAnamnese,
      functionalExam,
      physicalExam,
      diagnostic,
      medicalOrder,
      control,
      aditionalInfo,
      lastAttentionId,
      patientDocument
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update patient history configurations',
    description: 'Updates patient history information and status',
  })
  @ApiParam({ name: 'id', description: 'Patient history ID', example: 'patient-history-123' })
  @ApiBody({ type: PatientHistoryUpdateDto })
  @ApiResponse({
    status: 200,
    description: 'Patient history updated successfully',
    type: PatientHistory,
  })
  @ApiResponse({ status: 404, description: 'Patient history not found' })
  public async updatePatientHistoryConfigurations(
    @User() user,
    @Param() params: any,
    @Body() body: PatientHistoryUpdateDto
  ): Promise<PatientHistory> {
    const { id } = params;
    const {
      personalData,
      consultationReason,
      currentIllness,
      patientAnamnese,
      functionalExam,
      physicalExam,
      diagnostic,
      medicalOrder,
      control,
      aditionalInfo,
      active,
      available,
      lastAttentionId,
      patientDocument,
    } = body;
    return this.patientHistoryService.updatePatientHistoryConfigurations(
      user,
      id,
      personalData,
      consultationReason,
      currentIllness,
      patientAnamnese,
      functionalExam,
      physicalExam,
      diagnostic,
      medicalOrder,
      control,
      aditionalInfo,
      active,
      available,
      lastAttentionId,
      patientDocument
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/control/:id')
  @ApiOperation({
    summary: 'Update patient history control',
    description: 'Updates control information for a patient history',
  })
  @ApiParam({ name: 'id', description: 'Patient history ID', example: 'patient-history-123' })
  @ApiBody({ type: PatientHistory })
  @ApiResponse({
    status: 200,
    description: 'Patient history control updated successfully',
    type: PatientHistory,
  })
  @ApiResponse({ status: 404, description: 'Patient history not found' })
  public async updatePatientHistoryControl(
    @User() user,
    @Param() params: any,
    @Body() body: PatientHistory
  ): Promise<PatientHistory> {
    const { id } = params;
    const { control, patientDocument, lastAttentionId } = body;
    return this.patientHistoryService.updatePatientHistoryControl(
      user,
      id,
      control,
      patientDocument,
      lastAttentionId
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/save')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Save patient history',
    description: 'Creates or updates a patient history record',
  })
  @ApiBody({ type: PatientHistoryUpdateDto })
  @ApiResponse({
    status: 201,
    description: 'Patient history saved successfully',
    type: PatientHistory,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async savePatientHistory(
    @User() user,
    @Body() body: PatientHistoryUpdateDto
  ): Promise<PatientHistory> {
    const {
      commerceId,
      clientId,
      type,
      personalData,
      consultationReason,
      currentIllness,
      patientAnamnese,
      functionalExam,
      physicalExam,
      diagnostic,
      medicalOrder,
      control,
      aditionalInfo,
      lastAttentionId,
      active,
      available,
      patientDocument,
    } = body;
    return this.patientHistoryService.savePatientHistory(
      user,
      commerceId,
      clientId,
      type,
      personalData,
      consultationReason,
      currentIllness,
      patientAnamnese,
      functionalExam,
      physicalExam,
      diagnostic,
      medicalOrder,
      control,
      aditionalInfo,
      active,
      available,
      lastAttentionId,
      patientDocument
    );
  }
}
