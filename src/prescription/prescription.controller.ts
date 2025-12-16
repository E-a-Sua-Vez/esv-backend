import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { MedicationSearchDto } from './dto/medication-search.dto';
import { MedicationCatalog } from './model/medication.entity';
import { Prescription } from './model/prescription.entity';
import { PrescriptionPdfService } from './prescription-pdf.service';
import { PrescriptionService } from './prescription.service';

@ApiTags('prescription')
@Controller('prescription')
export class PrescriptionController {
  constructor(
    private readonly prescriptionService: PrescriptionService,
    private readonly prescriptionPdfService: PrescriptionPdfService
  ) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/medications/search')
  @ApiOperation({
    summary: 'Search medications',
    description: 'Search for medications in the catalog',
  })
  @ApiResponse({
    status: 200,
    description: 'List of medications',
  })
  async searchMedications(@Query() searchDto: MedicationSearchDto) {
    return this.prescriptionService.searchMedications(searchDto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/medications/:id')
  @ApiOperation({
    summary: 'Get medication by ID',
    description: 'Retrieves a medication from the catalog by ID',
  })
  @ApiParam({ name: 'id', description: 'Medication ID' })
  @ApiResponse({
    status: 200,
    description: 'Medication found',
    type: MedicationCatalog,
  })
  @ApiResponse({ status: 404, description: 'Medication not found' })
  async getMedicationById(@Param('id') id: string) {
    return this.prescriptionService.getMedicationById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new prescription',
    description: 'Creates a structured prescription with medications',
  })
  @ApiBody({ type: CreatePrescriptionDto })
  @ApiResponse({
    status: 201,
    description: 'Prescription created successfully',
    type: Prescription,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createPrescription(
    @User() user,
    @Body() createDto: CreatePrescriptionDto
  ): Promise<Prescription> {
    return this.prescriptionService.createPrescription(user, createDto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get prescription by ID',
    description: 'Retrieves a prescription by its ID',
  })
  @ApiParam({ name: 'id', description: 'Prescription ID' })
  @ApiResponse({
    status: 200,
    description: 'Prescription found',
    type: Prescription,
  })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  async getPrescriptionById(@Param('id') id: string): Promise<Prescription> {
    return this.prescriptionService.getPrescriptionById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/client/:commerceId/:clientId')
  @ApiOperation({
    summary: 'Get prescriptions by client',
    description: 'Retrieves all prescriptions for a specific client',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID' })
  @ApiParam({ name: 'clientId', description: 'Client ID' })
  @ApiResponse({
    status: 200,
    description: 'List of prescriptions',
    type: [Prescription],
  })
  async getPrescriptionsByClient(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string
  ): Promise<Prescription[]> {
    return this.prescriptionService.getPrescriptionsByClient(commerceId, clientId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/client/:commerceId/:clientId/active')
  @ApiOperation({
    summary: 'Get active prescriptions by client',
    description: 'Retrieves all active prescriptions for a specific client',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID' })
  @ApiParam({ name: 'clientId', description: 'Client ID' })
  @ApiResponse({
    status: 200,
    description: 'List of active prescriptions',
    type: [Prescription],
  })
  async getActivePrescriptionsByClient(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string
  ): Promise<Prescription[]> {
    return this.prescriptionService.getActivePrescriptionsByClient(commerceId, clientId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/refill')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refill prescription',
    description: 'Refills a prescription or a specific medication',
  })
  @ApiParam({ name: 'id', description: 'Prescription ID' })
  @ApiQuery({
    name: 'medicationIndex',
    required: false,
    description: 'Index of medication to refill',
  })
  @ApiResponse({
    status: 200,
    description: 'Prescription refilled successfully',
    type: Prescription,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async refillPrescription(
    @User() user,
    @Param('id') id: string,
    @Query('medicationIndex') medicationIndex?: number
  ): Promise<Prescription> {
    const index =
      medicationIndex !== undefined ? parseInt(medicationIndex.toString(), 10) : undefined;
    return this.prescriptionService.refillPrescription(user, id, index);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/dispensation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record dispensation',
    description: 'Records a medication dispensation',
  })
  @ApiParam({ name: 'id', description: 'Prescription ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pharmacy: { type: 'string' },
        pharmacist: { type: 'string' },
        quantity: { type: 'number' },
        notes: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Dispensation recorded successfully',
    type: Prescription,
  })
  async recordDispensation(
    @User() user,
    @Param('id') id: string,
    @Body()
    dispensationData: {
      pharmacy?: string;
      pharmacist?: string;
      quantity: number;
      notes?: string;
    }
  ): Promise<Prescription> {
    return this.prescriptionService.recordDispensation(user, id, dispensationData);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel prescription',
    description: 'Cancels a prescription',
  })
  @ApiParam({ name: 'id', description: 'Prescription ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
      },
    },
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Prescription cancelled successfully',
    type: Prescription,
  })
  async cancelPrescription(
    @User() user,
    @Param('id') id: string,
    @Body() body?: { reason?: string }
  ): Promise<Prescription> {
    return this.prescriptionService.cancelPrescription(user, id, body?.reason);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/validate-interactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate medication interactions',
    description: 'Validates potential interactions between medications',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        medicationIds: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Interaction validation result',
  })
  async validateInteractions(@Body() body: { medicationIds: string[] }) {
    return this.prescriptionService.validateMedicationInteractions(body.medicationIds);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id/pdf')
  @ApiOperation({
    summary: 'Download prescription PDF',
    description: 'Downloads the PDF file for a prescription',
  })
  @ApiParam({ name: 'id', description: 'Prescription ID' })
  @ApiResponse({
    status: 200,
    description: 'PDF file',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'PDF not found' })
  async downloadPrescriptionPdf(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const prescription = await this.prescriptionService.getPrescriptionById(id);
    const pdfStream = await this.prescriptionPdfService.getPrescriptionPdf(
      prescription.id,
      prescription.commerceId
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="prescription-${prescription.id}.pdf"`
    );

    pdfStream.pipe(res);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id/pdf-url')
  @ApiOperation({
    summary: 'Get prescription PDF URL',
    description: 'Gets a signed URL to download the prescription PDF',
  })
  @ApiParam({ name: 'id', description: 'Prescription ID' })
  @ApiQuery({
    name: 'expiresIn',
    required: false,
    description: 'URL expiration in seconds (default: 3600)',
  })
  @ApiResponse({
    status: 200,
    description: 'Signed URL for PDF download',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        expiresIn: { type: 'number' },
      },
    },
  })
  async getPrescriptionPdfUrl(
    @Param('id') id: string,
    @Query('expiresIn') expiresIn?: number
  ): Promise<{ url: string; expiresIn: number }> {
    const prescription = await this.prescriptionService.getPrescriptionById(id);
    const expires = expiresIn ? parseInt(expiresIn.toString(), 10) : 3600;
    const url = await this.prescriptionPdfService.getPrescriptionPdfUrl(
      prescription.id,
      prescription.commerceId,
      expires
    );

    return { url, expiresIn: expires };
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/suggestions/attention/:commerceId/:clientId/:attentionId')
  @ApiOperation({
    summary: 'Get prescription suggestions for attention',
    description:
      'Gets active prescriptions with matching products and stock availability for an attention',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID' })
  @ApiParam({ name: 'clientId', description: 'Client ID' })
  @ApiParam({ name: 'attentionId', description: 'Attention ID' })
  @ApiResponse({
    status: 200,
    description: 'List of prescription suggestions with product availability',
  })
  async getPrescriptionSuggestionsForAttention(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string,
    @Param('attentionId') attentionId: string
  ) {
    return this.prescriptionService.getPrescriptionSuggestionsForAttention(
      commerceId,
      clientId,
      attentionId
    );
  }
}
