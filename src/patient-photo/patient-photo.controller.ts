import { Readable } from 'stream';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';

import { UniversalAuthGuard } from './universal-auth.guard';
import { User } from '../auth/user.decorator';
import { PatientPhotoService } from './patient-photo.service';
import { PatientPhoto, PatientPhotoUploadDto } from './model/patient-photo.entity';
import { AuthGuard } from '@/auth/auth.guard';

@ApiTags('patient-photos')
@Controller('patient-photos')
export class PatientPhotoController {
  constructor(private readonly patientPhotoService: PatientPhotoService) {}

  @UseGuards(UniversalAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('photo'))
  @Post(':commerceId/:clientId')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload patient photo',
    description: 'Uploads a new photo for a patient',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'clientId', description: 'Client ID', example: 'client-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Patient photo file (JPG, PNG, WebP, max 5MB)',
        },
        photoType: {
          type: 'string',
          example: 'patient_profile',
          description: 'Type of photo',
        },
        uploadDate: {
          type: 'string',
          format: 'date-time',
          description: 'Upload date',
        },
      },
      required: ['photo'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Photo uploaded successfully',
    type: PatientPhoto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadPatientPhoto(
    @User() user: any,
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string,
    @UploadedFile() file: any,
    @Body() body: PatientPhotoUploadDto
  ): Promise<PatientPhoto> {
    const metadata = {
      capturedFrom: body.photoType === 'camera_capture' ? 'camera' : 'upload',
      uploadDate: body.uploadDate,
    };

    return this.patientPhotoService.uploadPatientPhoto(
      user.id || user.email,
      commerceId,
      clientId,
      file,
      metadata
    );
  }

  @UseGuards(UniversalAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get(':commerceId/:clientId')
  @ApiOperation({
    summary: 'Get patient photo metadata',
    description: 'Retrieves patient photo metadata',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'clientId', description: 'Client ID', example: 'client-123' })
  @ApiResponse({
    status: 200,
    description: 'Patient photo metadata',
    type: PatientPhoto,
  })
  @ApiResponse({ status: 404, description: 'Photo not found' })
  async getPatientPhoto(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string
  ): Promise<PatientPhoto | null> {
    const result = await this.patientPhotoService.getPatientPhoto(commerceId, clientId);

    if (!result) {
      console.error(`🔍 PHOTO_DEBUG: Returning null/404 for no photo found`);
      return null;
    }

    return result;
  }

  @UseGuards(UniversalAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get(':commerceId/:clientId/:photoId')
  @ApiOperation({
    summary: 'Get patient photo file',
    description: 'Retrieves and streams the patient photo file',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'clientId', description: 'Client ID', example: 'client-123' })
  @ApiParam({ name: 'photoId', description: 'Photo ID', example: 'photo-123' })
  @ApiResponse({ status: 200, description: 'Patient photo file stream' })
  @ApiResponse({ status: 404, description: 'Photo not found' })
  async getPatientPhotoFile(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string,
    @Param('photoId') photoId: string,
    @Res() response: any
  ): Promise<Readable> {
    const readable = await this.patientPhotoService.getPatientPhotoStream(
      commerceId,
      clientId,
      photoId
    );
    readable.on('error', (error: any) => {
      // Evitar que errores de S3 tumben el proceso
      const status = error?.code === 'NoSuchKey' ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
      const message =
        error?.code === 'NoSuchKey' ? 'Foto no encontrada' : 'Error al obtener la foto del paciente';

      if (!response.headersSent) {
        response.status(status).send({ message });
      }
    });
    response.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    });
    return readable.pipe(response);
  }

  @UseGuards(UniversalAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get(':commerceId/:clientId/:photoId/thumbnail')
  @ApiOperation({
    summary: 'Get patient photo thumbnail',
    description: 'Retrieves and streams the patient photo thumbnail',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'clientId', description: 'Client ID', example: 'client-123' })
  @ApiParam({ name: 'photoId', description: 'Photo ID', example: 'photo-123' })
  @ApiResponse({ status: 200, description: 'Patient photo thumbnail stream' })
  @ApiResponse({ status: 404, description: 'Thumbnail not found' })
  async getPatientPhotoThumbnail(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string,
    @Param('photoId') photoId: string,
    @Res() response: any
  ): Promise<Readable> {
    const readable = await this.patientPhotoService.getPatientPhotoThumbnailStream(
      commerceId,
      clientId,
      photoId
    );
    readable.on('error', (error: any) => {
      const status = error?.code === 'NoSuchKey' ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
      const message =
        error?.code === 'NoSuchKey' ? 'Miniatura no encontrada' : 'Error al obtener la miniatura';

      if (!response.headersSent) {
        response.status(status).send({ message });
      }
    });
    response.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    });
    return readable.pipe(response);
  }

  @UseGuards(UniversalAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('photo'))
  @Put(':commerceId/:clientId')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update patient photo',
    description: 'Replaces the existing patient photo with a new one',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'clientId', description: 'Client ID', example: 'client-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: {
          type: 'string',
          format: 'binary',
          description: 'New patient photo file (JPG, PNG, WebP, max 5MB)',
        },
        photoType: {
          type: 'string',
          example: 'patient_profile',
          description: 'Type of photo',
        },
        uploadDate: {
          type: 'string',
          format: 'date-time',
          description: 'Upload date',
        },
      },
      required: ['photo'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Photo updated successfully',
    type: PatientPhoto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid file' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async updatePatientPhoto(
    @User() user: any,
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string,
    @UploadedFile() file: any,
    @Body() body: PatientPhotoUploadDto
  ): Promise<PatientPhoto> {
    const metadata = {
      capturedFrom: body.photoType === 'camera_capture' ? 'camera' : 'upload',
      uploadDate: body.uploadDate,
    };

    return this.patientPhotoService.updatePatientPhoto(
      user.id || user.email,
      commerceId,
      clientId,
      file,
      metadata
    );
  }

  @UseGuards(UniversalAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete(':commerceId/:clientId/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete patient photo',
    description: 'Deletes a patient photo and its thumbnail',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'clientId', description: 'Client ID', example: 'client-123' })
  @ApiParam({ name: 'photoId', description: 'Photo ID', example: 'photo-123' })
  @ApiResponse({ status: 204, description: 'Photo deleted successfully' })
  @ApiResponse({ status: 404, description: 'Photo not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized' })
  async deletePatientPhoto(
    @User() user: any,
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string,
    @Param('photoId') photoId: string
  ): Promise<void> {
    return this.patientPhotoService.deletePatientPhoto(
      user.id || user.email,
      commerceId,
      clientId,
      photoId
    );
  }
}












