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
  UseInterceptors,
  UploadedFile,
  HttpException,
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

import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/user.decorator';

import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import { Professional } from './model/professional.entity';
import { ProfessionalService } from './professional.service';

@ApiTags('professional')
@Controller('professional')
export class ProfessionalController {
  constructor(private readonly professionalService: ProfessionalService) {}

  @Get('/photo-url/:id')
  @ApiOperation({
    summary: 'Get professional profile photo signed URL (public)',
    description: 'Returns a signed URL for the professional profile photo. No authentication required.',
  })
  @ApiParam({ name: 'id', description: 'Professional ID', example: 'professional-123' })
  @ApiResponse({ status: 200, description: 'Signed URL returned', type: Object })
  @ApiResponse({ status: 404, description: 'Professional not found' })
  public async getProfilePhotoUrl(
    @Param('id') id: string
  ): Promise<{ photoUrl: string | null }> {
    return this.professionalService.getProfilePhotoSignedUrl(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/by-collaborator/:collaboratorId')
  @ApiOperation({
    summary: 'Get professional by collaborator ID',
    description: 'Retrieves a professional associated with a collaborator',
  })
  @ApiParam({ name: 'collaboratorId', description: 'Collaborator ID', example: 'collaborator-123' })
  @ApiResponse({ status: 200, description: 'Professional found', type: Professional })
  @ApiResponse({ status: 404, description: 'Professional not found' })
  public async getProfessionalByCollaboratorId(@Param('collaboratorId') collaboratorId: string): Promise<Professional> {
    return this.professionalService.getProfessionalByCollaboratorId(collaboratorId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get professional by ID',
    description: 'Retrieves a professional by their unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Professional ID', example: 'professional-123' })
  @ApiResponse({ status: 200, description: 'Professional found', type: Professional })
  @ApiResponse({ status: 404, description: 'Professional not found' })
  public async getProfessionalById(@Param('id') id: string): Promise<Professional> {
    return this.professionalService.getProfessionalById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({
    summary: 'Get all professionals',
    description: 'Retrieves a list of all professionals',
  })
  @ApiResponse({ status: 200, description: 'List of professionals', type: [Professional] })
  public async getProfessionals(): Promise<Professional[]> {
    return this.professionalService.getProfessionals();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/business/:businessId')
  @ApiOperation({
    summary: 'Get professionals by business',
    description: 'Retrieves all professionals for a specific business',
  })
  @ApiParam({ name: 'businessId', description: 'Business ID', example: 'business-123' })
  @ApiResponse({ status: 200, description: 'List of professionals', type: [Professional] })
  public async getProfessionalsByBusiness(
    @Param('businessId') businessId: string
  ): Promise<Professional[]> {
    return this.professionalService.getProfessionalsByBusiness(businessId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId')
  @ApiOperation({
    summary: 'Get professionals by commerce',
    description: 'Retrieves all professionals for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of professionals', type: [Professional] })
  public async getProfessionalsByCommerce(
    @Param('commerceId') commerceId: string
  ): Promise<Professional[]> {
    return this.professionalService.getProfessionalsByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId/active')
  @ApiOperation({
    summary: 'Get active professionals by commerce',
    description: 'Retrieves all active and available professionals for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of active professionals', type: [Professional] })
  public async getActiveProfessionalsByCommerce(
    @Param('commerceId') commerceId: string
  ): Promise<Professional[]> {
    return this.professionalService.getActiveProfessionalsByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/list/:ids')
  @ApiOperation({
    summary: 'Get professionals by IDs',
    description: 'Retrieves multiple professionals by their IDs (comma-separated)',
  })
  @ApiParam({
    name: 'ids',
    description: 'Comma-separated professional IDs',
    example: 'prof-1,prof-2,prof-3',
  })
  @ApiResponse({ status: 200, description: 'List of professionals', type: [Professional] })
  public async getProfessionalsById(@Param('ids') ids: string): Promise<Professional[]> {
    return this.professionalService.getProfessionalsById(ids.split(','));
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/service/:serviceId/available')
  @ApiOperation({
    summary: 'Get available professionals for a service',
    description: 'Retrieves professionals that can perform a specific service',
  })
  @ApiParam({ name: 'serviceId', description: 'Service ID', example: 'service-123' })
  @ApiResponse({
    status: 200,
    description: 'List of available professionals',
    type: [Professional],
  })
  public async getAvailableProfessionalsForService(
    @Param('serviceId') serviceId: string
  ): Promise<Professional[]> {
    return this.professionalService.getAvailableProfessionalsForService(serviceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new professional',
    description: 'Creates a new professional for a business',
  })
  @ApiBody({ type: CreateProfessionalDto })
  @ApiResponse({
    status: 201,
    description: 'Professional created successfully',
    type: Professional,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createProfessional(
    @User() user: string,
    @Body() body: CreateProfessionalDto
  ): Promise<Professional> {
    return this.professionalService.createProfessional(user, body);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update professional',
    description: 'Updates the configuration of an existing professional',
  })
  @ApiParam({ name: 'id', description: 'Professional ID', example: 'professional-123' })
  @ApiBody({ type: UpdateProfessionalDto })
  @ApiResponse({ status: 200, description: 'Professional updated successfully', type: Professional })
  @ApiResponse({ status: 404, description: 'Professional not found' })
  public async updateProfessional(
    @User() user: string,
    @Param('id') id: string,
    @Body() body: UpdateProfessionalDto
  ): Promise<Professional> {
    return this.professionalService.updateProfessional(user, id, body);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id/profile-photo')
  @ApiOperation({
    summary: 'Get profile photo URL',
    description: 'Returns the profile photo URL for the professional if it exists'
  })
  @ApiParam({ name: 'id', description: 'Professional ID' })
  public async getProfilePhoto(
    @Param('id') id: string
  ): Promise<{ photoUrl: string | null }> {
    const { photoUrl } = await this.professionalService.getProfilePhotoSignedUrl(id);
    if (photoUrl === null) {
      const professional = await this.professionalService.getProfessionalById(id);
      if (!professional) {
        throw new HttpException('Professional not found', HttpStatus.NOT_FOUND);
      }
    }
    return { photoUrl };
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/profile-photo')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiOperation({
    summary: 'Upload professional profile photo',
    description: 'Allows uploading a new profile photo for the professional'
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiParam({ name: 'id', description: 'Professional ID' })
  public async uploadProfilePhoto(
    @User() user,
    @Param('id') id: string,
    @UploadedFile() photo: any,
    @Body() body: any
  ): Promise<{ photoUrl: string }> {
    // Case 1: multipart file
    if (photo && photo.buffer) {
      return this.professionalService.uploadProfilePhoto(user, id, photo);
    }

    // Case 2: JSON with base64
    const base64 = body?.photo?.image || body?.image || body?.photoBase64;
    const filename = body?.photo?.filename || body?.filename || 'profile.jpg';

    if (base64) {
      // Allow data URL prefix
      const dataUrlMatch = /^data:(.*?);base64,(.*)$/.exec(base64);
      const mimeFromDataUrl = dataUrlMatch?.[1];
      const base64Payload = dataUrlMatch ? dataUrlMatch[2] : base64;

      let buffer: Buffer;
      try {
        buffer = Buffer.from(base64Payload, 'base64');
      } catch (e) {
        throw new HttpException('Invalid base64 image', HttpStatus.BAD_REQUEST);
      }

      const ext = (filename?.split('.')?.pop() || 'jpg').toLowerCase();
      const mime = mimeFromDataUrl || (ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg');

      const virtualFile = {
        buffer,
        originalname: filename,
        mimetype: mime,
      };
      return this.professionalService.uploadProfilePhoto(user, id, virtualFile);
    }

    throw new HttpException(
      'Multipart file "photo" or JSON with { photo: { image, filename } } required',
      HttpStatus.BAD_REQUEST
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id/digital-signature')
  @ApiOperation({
    summary: 'Get digital signature URL',
    description: 'Returns the digital signature URL for the professional if it exists'
  })
  @ApiParam({ name: 'id', description: 'Professional ID' })
  public async getDigitalSignature(
    @Param('id') id: string
  ): Promise<{ signatureUrl: string | null }> {
    const { signatureUrl } = await this.professionalService.getDigitalSignatureSignedUrl(id);
    if (signatureUrl === null) {
      const professional = await this.professionalService.getProfessionalById(id);
      if (!professional) {
        throw new HttpException('Professional not found', HttpStatus.NOT_FOUND);
      }
    }
    return { signatureUrl };
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/digital-signature')
  @UseInterceptors(FileInterceptor('signature'))
  @ApiOperation({
    summary: 'Upload professional digital signature',
    description: 'Allows uploading a digital signature for the professional'
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiParam({ name: 'id', description: 'Professional ID' })
  public async uploadDigitalSignature(
    @User() user,
    @Param('id') id: string,
    @UploadedFile() signature: any,
    @Body() body: any
  ): Promise<{ signatureUrl: string }> {
    // Case 1: multipart file
    if (signature && signature.buffer) {
      return this.professionalService.uploadDigitalSignature(user, id, signature);
    }

    // Case 2: JSON with base64
    const base64 = body?.signature?.image || body?.image || body?.signatureBase64;
    const filename = body?.signature?.filename || body?.filename || 'signature.png';

    if (base64) {
      const dataUrlMatch = /^data:(.*?);base64,(.*)$/.exec(base64);
      const mimeFromDataUrl = dataUrlMatch?.[1];
      const base64Payload = dataUrlMatch ? dataUrlMatch[2] : base64;

      let buffer: Buffer;
      try {
        buffer = Buffer.from(base64Payload, 'base64');
      } catch (e) {
        throw new HttpException('Invalid base64 image', HttpStatus.BAD_REQUEST);
      }

      const ext = (filename?.split('.')?.pop() || 'png').toLowerCase();
      const mime = mimeFromDataUrl || (ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg');

      const virtualFile = {
        buffer,
        originalname: filename,
        mimetype: mime,
      };
      return this.professionalService.uploadDigitalSignature(user, id, virtualFile);
    }

    throw new HttpException(
      'Multipart file "signature" or JSON with { signature: { image, filename } } required',
      HttpStatus.BAD_REQUEST
    );
  }
}
