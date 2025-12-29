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
  HttpException,
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

import { CreateMedicalReferenceDto } from './dto/create-medical-reference.dto';
import { MedicalReferencePdfService } from './medical-reference-pdf.service';
import { MedicalReferenceService } from './medical-reference.service';
import { GeneratedDocumentService } from '../shared/services/generated-document.service';
import { MedicalReference } from './model/medical-reference.entity';

@ApiTags('medical-reference')
@Controller('medical-reference')
export class MedicalReferenceController {
  constructor(
    private readonly referenceService: MedicalReferenceService,
    private readonly referencePdfService: MedicalReferencePdfService,
    private readonly generatedDocumentService: GeneratedDocumentService
  ) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create medical reference',
    description: 'Creates a new medical reference',
  })
  @ApiBody({ type: CreateMedicalReferenceDto })
  @ApiResponse({
    status: 201,
    description: 'Reference created successfully',
    type: MedicalReference,
  })
  async createReference(
    @User() user,
    @Body() createDto: CreateMedicalReferenceDto
  ): Promise<MedicalReference> {
    return this.referenceService.createReference(user, createDto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get reference by ID',
    description: 'Retrieves a medical reference by its ID',
  })
  @ApiParam({ name: 'id', description: 'Reference ID' })
  @ApiResponse({
    status: 200,
    description: 'Reference found',
    type: MedicalReference,
  })
  async getReferenceById(@Param('id') id: string): Promise<MedicalReference> {
    return this.referenceService.getReferenceById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/client/:commerceId/:clientId')
  @ApiOperation({
    summary: 'Get references by client',
    description: 'Retrieves all references for a specific client',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID' })
  @ApiParam({ name: 'clientId', description: 'Client ID' })
  @ApiResponse({
    status: 200,
    description: 'List of references',
    type: [MedicalReference],
  })
  async getReferencesByClient(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string
  ): Promise<MedicalReference[]> {
    return this.referenceService.getReferencesByClient(commerceId, clientId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/accept')
  @ApiOperation({
    summary: 'Accept reference',
    description: 'Accepts a medical reference',
  })
  @ApiParam({ name: 'id', description: 'Reference ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        response: { type: 'string' },
      },
    },
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Reference accepted successfully',
    type: MedicalReference,
  })
  async acceptReference(
    @User() user,
    @Param('id') id: string,
    @Body() body?: { response?: string }
  ): Promise<MedicalReference> {
    return this.referenceService.acceptReference(user, id, body?.response);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/attend')
  @ApiOperation({
    summary: 'Mark reference as attended',
    description: 'Marks a medical reference as attended and adds return report',
  })
  @ApiParam({ name: 'id', description: 'Reference ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        returnReport: { type: 'string' },
      },
    },
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Reference marked as attended successfully',
    type: MedicalReference,
  })
  async markAsAttended(
    @User() user,
    @Param('id') id: string,
    @Body() body?: { returnReport?: string }
  ): Promise<MedicalReference> {
    return this.referenceService.markReferenceAsAttended(user, id, body?.returnReport);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/reject')
  @ApiOperation({
    summary: 'Reject reference',
    description: 'Rejects a medical reference',
  })
  @ApiParam({ name: 'id', description: 'Reference ID' })
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
    description: 'Reference rejected successfully',
    type: MedicalReference,
  })
  async rejectReference(
    @User() user,
    @Param('id') id: string,
    @Body() body?: { reason?: string }
  ): Promise<MedicalReference> {
    return this.referenceService.rejectReference(user, id, body?.reason);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id/pdf')
  @ApiOperation({
    summary: 'Download medical reference PDF',
    description: 'Downloads the PDF file for a medical reference',
  })
  @ApiParam({ name: 'id', description: 'Reference ID' })
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
  async downloadReferencePdf(@Param('id') id: string, @Res() res: Response): Promise<void> {
    try {
      const reference = await this.referenceService.getReferenceById(id);
      const pdfStream = await this.referencePdfService.getReferencePdf(
        reference.id,
        reference.commerceId
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="medical-reference-${reference.id}.pdf"`
      );

      pdfStream.pipe(res);
    } catch (error) {
      // Si el PDF no existe (404), intentar generarlo
      if (error.status === HttpStatus.NOT_FOUND || error.statusCode === HttpStatus.NOT_FOUND) {
        // Generar el PDF mediante el servicio (que lo genera de forma asíncrona)
        // Por ahora, retornar un error indicando que se está generando
        // En una próxima implementación, podríamos generar síncronamente aquí
        throw new HttpException(
          'PDF is being generated. Please try again in a few moments.',
          HttpStatus.NOT_FOUND
        );
      } else {
        throw error;
      }
    }
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id/pdf-url')
  @ApiOperation({
    summary: 'Get medical reference PDF URL',
    description: 'Gets a signed URL to download the medical reference PDF',
  })
  @ApiParam({ name: 'id', description: 'Reference ID' })
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
  async getReferencePdfUrl(
    @Param('id') id: string,
    @Query('expiresIn') expiresIn?: number
  ): Promise<{ url: string; expiresIn: number }> {
    const reference = await this.referenceService.getReferenceById(id);
    const expires = expiresIn ? parseInt(expiresIn.toString(), 10) : 3600;
    const url = await this.referencePdfService.getReferencePdfUrl(
      reference.id,
      reference.commerceId,
      expires
    );

    return { url, expiresIn: expires };
  }
}
