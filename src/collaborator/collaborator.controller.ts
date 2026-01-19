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
  HttpException,
  UseInterceptors,
  UploadedFile,
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
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

import { CollaboratorService } from './collaborator.service';
import { CollaboratorDetailsDto } from './dto/collaborator-details.dto';
import { CreateAssociatedProfessionalDto } from './dto/create-associated-professional.dto';
import { Collaborator } from './model/collaborator.entity';

@ApiTags('collaborator')
@Controller('collaborator')
export class CollaboratorController {
  constructor(private readonly collaboratorService: CollaboratorService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get collaborator by ID',
    description: 'Retrieves a collaborator by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Collaborator ID', example: 'collaborator-123' })
  @ApiResponse({ status: 200, description: 'Collaborator found', type: Collaborator })
  @ApiResponse({ status: 404, description: 'Collaborator not found' })
  public async getCollaboratorById(@Param() params: any): Promise<Collaborator> {
    const { id } = params;
    return this.collaboratorService.getCollaboratorById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/details/:id')
  @ApiOperation({
    summary: 'Get collaborator details',
    description: 'Retrieves detailed collaborator information',
  })
  @ApiParam({ name: 'id', description: 'Collaborator ID', example: 'collaborator-123' })
  @ApiResponse({ status: 200, description: 'Collaborator details', type: Collaborator })
  public async getCollaboratorDetailsById(@Param() params: any): Promise<Collaborator> {
    const { id } = params;
    return this.collaboratorService.getCollaboratorDetailsById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({
    summary: 'Get all collaborators',
    description: 'Retrieves a list of all collaborators',
  })
  @ApiResponse({ status: 200, description: 'List of collaborators', type: [Collaborator] })
  public async getCollaborators(): Promise<Collaborator[]> {
    return this.collaboratorService.getCollaborators();
  }

  @Get('/email/:email')
  @ApiOperation({
    summary: 'Get collaborator by email',
    description: 'Retrieves a collaborator by email address',
  })
  @ApiParam({
    name: 'email',
    description: 'Collaborator email',
    example: 'collaborator@example.com',
  })
  @ApiResponse({ status: 200, description: 'Collaborator found', type: Collaborator })
  public async getCollaboratorByEmail(@Param() params: any): Promise<Collaborator> {
    const { email } = params;
    return this.collaboratorService.getCollaboratorByEmail(email);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId')
  @ApiOperation({
    summary: 'Get collaborators by commerce ID',
    description: 'Retrieves all collaborators for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({
    status: 200,
    description: 'List of collaborators',
    type: [CollaboratorDetailsDto],
  })
  public async getCollaboratorsByCommerceId(
    @Param() params: any
  ): Promise<CollaboratorDetailsDto[]> {
    const { commerceId } = params;
    return this.collaboratorService.getCollaboratorsByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @Get('/details/commerceId/:commerceId')
  public async getDetailsCollaboratorsByCommerceId(
    @Param() params: any
  ): Promise<CollaboratorDetailsDto[]> {
    const { commerceId } = params;
    return this.collaboratorService.getDetailsCollaboratorsByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @Get('/commerceId/:commerceId/email/:email')
  public async getCollaboratorsByCommerceIdAndEmail(@Param() params: any): Promise<Collaborator> {
    const { commerceId, email } = params;
    return this.collaboratorService.getCollaboratorsByCommerceIdAndEmail(commerceId, email);
  }

  // Los endpoints de firma digital y datos médicos ahora están en ProfessionalController

  @Patch('/:id')
  @ApiOperation({
    summary: 'Actualizar colaborador',
    description: 'Actualiza los datos básicos de un colaborador',
  })
  @ApiParam({ name: 'id', description: 'ID del colaborador' })
  public async updateCollaborator(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Collaborator> {
    const { id } = params;
    const {
      name,
      lastName,
      idNumber,
      type,
      alias,
      phone,
      moduleId,
      active,
      available,
      servicesId,
      commercesId,
      role,
    } = body;
    return this.collaboratorService.updateCollaborator(
      user,
      id,
      name,
      moduleId,
      phone,
      active,
      available,
      alias,
      servicesId,
      type,
      commercesId,
      lastName,
      idNumber,
      role
    );
  }

  @UseGuards(AuthGuard)
  @Patch('/desactivate/:id')
  public async desactivate(@User() user, @Param() params: any): Promise<Collaborator> {
    const { id } = params;
    return this.collaboratorService.changeStatus(user, id, false);
  }

  @UseGuards(AuthGuard)
  @Patch('/activate/:id')
  public async activate(@User() user, @Param() params: any): Promise<Collaborator> {
    const { id } = params;
    return this.collaboratorService.changeStatus(user, id, true);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new collaborator',
    description: 'Creates a new collaborator account',
  })
  @ApiBody({ type: Collaborator })
  @ApiResponse({
    status: 201,
    description: 'Collaborator created successfully',
    type: Collaborator,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createCollaborator(@User() user, @Body() body: Collaborator): Promise<Collaborator> {
    const { name, lastName, idNumber, commerceId, commercesId, email, type, phone, moduleId, bot, alias, servicesId, role } =
      body;
    return this.collaboratorService.createCollaborator(
      user,
      name,
      commerceId,
      commercesId,
      email,
      type,
      phone,
      moduleId,
      bot,
      alias,
      servicesId,
      role,
      lastName,
      idNumber
    );
  }

  @Patch('/register-token/:id')
  public async registerToken(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Collaborator> {
    const { id } = params;
    const { token } = body;
    return this.collaboratorService.updateToken(user, id, token);
  }

  @Patch('/change-password/:id')
  public async changePassword(@User() user, @Param() params: any): Promise<Collaborator> {
    const { id } = params;
    return this.collaboratorService.changePassword(user, id);
  }

  @UseGuards(AuthGuard)
  @Patch('/:id/permission')
  public async updateCollaboratorPermission(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Collaborator> {
    const { id } = params;
    const { name, value } = body;
    return this.collaboratorService.updateCollaboratorPermission(user, id, name, value);
  }

  @UseGuards(AuthGuard)
  @Patch('/:id/module')
  public async updateModule(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Collaborator> {
    const { id } = params;
    const moduleId = body.module || body.moduleId;
    const collaborator = await this.collaboratorService.getCollaboratorById(id);
    if (!collaborator) {
      throw new HttpException('Collaborator not found', HttpStatus.NOT_FOUND);
    }
    return this.collaboratorService.updateCollaborator(
      user,
      id,
      collaborator.name,
      moduleId,
      collaborator.phone,
      collaborator.active,
      collaborator.available,
      collaborator.alias,
      collaborator.servicesId,
      collaborator.type,
      collaborator.commercesId
    );
  }

  // ========== NUEVOS ENDPOINTS PARA GESTIÓN MÉDICA ==========

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/medical-data')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar datos médicos del colaborador',
    description: 'Permite actualizar la información médica específica de un colaborador (licencia, especialización, etc.)'
  })
  @ApiParam({ name: 'id', description: 'ID del colaborador' })
  public async updateMedicalData(
    @User() user,
    @Param('id') id: string,
    @Body() body: {
      medicalLicense?: string;
      medicalLicenseState?: string;
      specialization?: string;
      subspecialization?: string;
      medicalSchool?: string;
      graduationYear?: number;
      professionalAddress?: string;
      professionalPhone?: string;
      professionalMobile?: string;
      professionalEmail?: string;
      clinicName?: string;
      clinicAddress?: string;
      clinicPhone?: string;
      workingHours?: string;
      acceptsInsurance?: string[];
      languages?: string[];
    }
  ): Promise<Collaborator> {
    return this.collaboratorService.updateMedicalData(user, id, body);
  }

  // Eliminado: POST JSON para actualizar foto de perfil (duplicaba la ruta POST multipart)

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/role')
  @ApiOperation({
    summary: 'Actualizar rol del colaborador',
    description: 'Cambia el rol específico del colaborador (médico, enfermero, secretaria, etc.)'
  })
  @ApiParam({ name: 'id', description: 'ID del colaborador' })
  public async updateCollaboratorRole(
    @User() user,
    @Param('id') id: string,
    @Body() body: { role: string }
  ): Promise<Collaborator> {
    return this.collaboratorService.updateCollaboratorRole(user, id, body.role as any);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/medical/commerce/:commerceId')
  @ApiOperation({
    summary: 'Obtener colaboradores médicos de un commerce',
    description: 'Retorna solo los colaboradores que son médicos o especialistas con licencia médica'
  })
  @ApiParam({ name: 'commerceId', description: 'ID del commerce' })
  public async getMedicalCollaboratorsByCommerceId(
    @Param('commerceId') commerceId: string
  ): Promise<Collaborator[]> {
    return this.collaboratorService.getMedicalCollaboratorsByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id/for-documents')
  @ApiOperation({
    summary: 'Obtener colaborador para documentos médicos',
    description: 'Retorna los datos completos del colaborador necesarios para generar documentos médicos'
  })
  @ApiParam({ name: 'id', description: 'ID del colaborador' })
  public async getCollaboratorForMedicalDocuments(
    @Param('id') id: string
  ): Promise<Collaborator> {
    return this.collaboratorService.getCollaboratorForMedicalDocuments(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/extended')
  @ApiOperation({
    summary: 'Actualización extendida del colaborador',
    description: 'Permite actualizar todos los campos del colaborador incluyendo los nuevos campos médicos'
  })
  @ApiParam({ name: 'id', description: 'ID del colaborador' })
  public async updateCollaboratorExtended(
    @User() user,
    @Param('id') id: string,
    @Body() body: any
  ): Promise<Collaborator> {
    return this.collaboratorService.updateCollaboratorExtended(user, id, body);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id/digital-signature')
  @ApiOperation({
    summary: 'Obtener URL de la firma digital',
    description: 'Retorna la URL de la firma digital del colaborador; firma si es privada'
  })
  @ApiParam({ name: 'id', description: 'ID del colaborador' })
  public async getDigitalSignature(
    @Param('id') id: string
  ): Promise<{ signatureUrl: string | null }> {
    const { signatureUrl } = await this.collaboratorService.getDigitalSignatureSignedUrl(id);
    if (signatureUrl === null) {
      const collaborator = await this.collaboratorService.getCollaboratorById(id);
      if (!collaborator) {
        throw new HttpException('Colaborador no existe', HttpStatus.NOT_FOUND);
      }
    }
    return { signatureUrl };
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id/profile-photo')
  @ApiOperation({
    summary: 'Obtener URL de la foto de perfil',
    description: 'Retorna la URL de la foto de perfil del colaborador si existe'
  })
  @ApiParam({ name: 'id', description: 'ID del colaborador' })
  public async getProfilePhoto(
    @Param('id') id: string
  ): Promise<{ photoUrl: string | null }> {
    const { photoUrl } = await this.collaboratorService.getProfilePhotoSignedUrl(id);
    if (photoUrl === null) {
      // Si el colaborador no existe o no tiene foto
      const collaborator = await this.collaboratorService.getCollaboratorById(id);
      if (!collaborator) {
        throw new HttpException('Colaborador no existe', HttpStatus.NOT_FOUND);
      }
    }
    return { photoUrl };
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/profile-photo')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiOperation({
    summary: 'Subir foto de perfil del colaborador',
    description: 'Permite subir una nueva foto de perfil para el colaborador'
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiParam({ name: 'id', description: 'ID del colaborador' })
  public async uploadProfilePhoto(
    @User() user,
    @Param('id') id: string,
    @UploadedFile() photo: any,
    @Body() body: any
  ): Promise<{ photoUrl: string }> {
    // Caso 1: archivo multipart
    if (photo && photo.buffer) {
      return this.collaboratorService.uploadProfilePhoto(user, id, photo);
    }

    // Caso 2: JSON con base64
    const base64 = body?.photo?.image || body?.image || body?.photoBase64;
    const filename = body?.photo?.filename || body?.filename || 'profile.jpg';

    if (base64) {
      // Permitir prefijo data URL
      const dataUrlMatch = /^data:(.*?);base64,(.*)$/.exec(base64);
      const mimeFromDataUrl = dataUrlMatch?.[1];
      const base64Payload = dataUrlMatch ? dataUrlMatch[2] : base64;

      let buffer: Buffer;
      try {
        buffer = Buffer.from(base64Payload, 'base64');
      } catch (e) {
        throw new HttpException('Imagen base64 inválida', HttpStatus.BAD_REQUEST);
      }

      const ext = (filename?.split('.')?.pop() || 'jpg').toLowerCase();
      const mime = mimeFromDataUrl || (ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg');

      const virtualFile = {
        buffer,
        originalname: filename,
        mimetype: mime,
      };
      return this.collaboratorService.uploadProfilePhoto(user, id, virtualFile);
    }

    // Si no llegó ni archivo ni base64
    throw new HttpException(
      'Se requiere archivo multipart "photo" o JSON con { photo: { image, filename } }',
      HttpStatus.BAD_REQUEST
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/profile-photo')
  @ApiOperation({
    summary: 'Actualizar URL de la foto de perfil',
    description: 'Permite actualizar la URL de la foto de perfil del colaborador'
  })
  @ApiParam({ name: 'id', description: 'ID del colaborador' })
  public async updateProfilePhotoUrl(
    @User() user,
    @Param('id') id: string,
    @Body() body: { photoUrl: string }
  ): Promise<Collaborator> {
    if (!body || !body.photoUrl) {
      throw new HttpException('photoUrl es requerido', HttpStatus.BAD_REQUEST);
    }
    return this.collaboratorService.updateProfilePhoto(user, id, body.photoUrl);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/create-associated-professional')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear Professional asociado',
    description: 'Crea un perfil Professional asociado a partir de los datos del Collaborator. Establece relación bidireccional.'
  })
  @ApiParam({ name: 'id', description: 'ID del colaborador', example: 'collab-123' })
  @ApiBody({ type: CreateAssociatedProfessionalDto })
  @ApiResponse({
    status: 201,
    description: 'Professional creado y asociado exitosamente',
    schema: {
      type: 'object',
      properties: {
        collaborator: { type: 'object', description: 'Collaborator actualizado con isProfessional=true' },
        professional: { type: 'object', description: 'Professional creado' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'El colaborador ya tiene un professional asociado'
  })
  @ApiResponse({
    status: 404,
    description: 'Colaborador no encontrado'
  })
  public async createAssociatedProfessional(
    @User() user,
    @Param('id') id: string,
    @Body() dto: CreateAssociatedProfessionalDto
  ): Promise<{ collaborator: Collaborator; professional: any }> {
    return this.collaboratorService.createAssociatedProfessional(user, id, dto);
  }
}
