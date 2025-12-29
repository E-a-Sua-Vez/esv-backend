import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
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
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

import { PdfTemplateService } from '../services/pdf-template.service';
import { PdfTemplate } from '../model/pdf-template.entity';
import { CreatePdfTemplateDto } from '../dto/create-pdf-template.dto';

@ApiTags('pdf-template')
@Controller('pdf-template')
export class PdfTemplateController {
  constructor(private readonly pdfTemplateService: PdfTemplateService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({
    summary: 'Listar templates de PDF',
    description: 'Obtiene una lista de templates de PDF según filtros',
  })
  @ApiQuery({
    name: 'documentType',
    required: false,
    description: 'Tipo de documento (prescription, exam_order, reference)',
  })
  @ApiQuery({
    name: 'commerceId',
    required: false,
    description: 'ID del commerce',
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    description: 'Alcance (GLOBAL, COMMERCE, PERSONAL)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de templates',
    type: [PdfTemplate],
  })
  async listTemplates(
    @Query('documentType') documentType?: 'prescription' | 'exam_order' | 'reference',
    @Query('commerceId') commerceId?: string,
    @Query('scope') scope?: 'GLOBAL' | 'COMMERCE' | 'PERSONAL'
  ): Promise<PdfTemplate[]> {
    return this.pdfTemplateService.listTemplates(documentType, commerceId, scope);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Obtener template por ID',
    description: 'Obtiene un template de PDF por su ID',
  })
  @ApiParam({ name: 'id', description: 'ID del template' })
  @ApiResponse({
    status: 200,
    description: 'Template encontrado',
    type: PdfTemplate,
  })
  @ApiResponse({ status: 404, description: 'Template no encontrado' })
  async getTemplateById(@Param('id') id: string): Promise<PdfTemplate | null> {
    return this.pdfTemplateService.getTemplateById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear template de PDF',
    description: 'Crea un nuevo template de PDF',
  })
  @ApiBody({ type: CreatePdfTemplateDto })
  @ApiResponse({
    status: 201,
    description: 'Template creado exitosamente',
    type: PdfTemplate,
  })
  async createTemplate(
    @User() user,
    @Body() createDto: CreatePdfTemplateDto
  ): Promise<PdfTemplate> {
    return this.pdfTemplateService.createTemplate(user.id || user, createDto as any);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Actualizar template de PDF',
    description: 'Actualiza un template de PDF existente',
  })
  @ApiParam({ name: 'id', description: 'ID del template' })
  @ApiBody({ type: CreatePdfTemplateDto })
  @ApiResponse({
    status: 200,
    description: 'Template actualizado exitosamente',
    type: PdfTemplate,
  })
  @ApiResponse({ status: 404, description: 'Template no encontrado' })
  async updateTemplate(
    @User() user,
    @Param('id') id: string,
    @Body() updateDto: Partial<CreatePdfTemplateDto>
  ): Promise<PdfTemplate> {
    return this.pdfTemplateService.updateTemplate(user.id || user, id, updateDto as any);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete('/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar template de PDF',
    description: 'Elimina un template de PDF (soft delete)',
  })
  @ApiParam({ name: 'id', description: 'ID del template' })
  @ApiResponse({
    status: 204,
    description: 'Template eliminado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Template no encontrado' })
  async deleteTemplate(@Param('id') id: string): Promise<void> {
    const template = await this.pdfTemplateService.getTemplateById(id);
    if (!template) {
      throw new Error('Template not found');
    }
    await this.pdfTemplateService.updateTemplate('system', id, { active: false, available: false });
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/set-default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Establecer template como por defecto',
    description: 'Establece un template como template por defecto para su tipo de documento',
  })
  @ApiParam({ name: 'id', description: 'ID del template' })
  @ApiResponse({
    status: 200,
    description: 'Template establecido como por defecto',
  })
  async setAsDefault(@User() user, @Param('id') id: string): Promise<PdfTemplate> {
    const template = await this.pdfTemplateService.getTemplateById(id);
    if (!template) {
      throw new Error('Template not found');
    }

    // Desmarcar otros templates como default del mismo tipo y scope
    const allTemplates = await this.pdfTemplateService.listTemplates(
      template.documentType,
      template.commerceId,
      template.scope
    );

    for (const t of allTemplates) {
      if (t.isDefault && t.id !== id) {
        await this.pdfTemplateService.updateTemplate('system', t.id, { isDefault: false });
      }
    }

    // Marcar este template como default
    return this.pdfTemplateService.updateTemplate(user.id || user, id, { isDefault: true });
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generar preview del template',
    description: 'Genera un PDF de preview del template con datos de ejemplo',
  })
  @ApiParam({ name: 'id', description: 'ID del template' })
  @ApiResponse({
    status: 200,
    description: 'PDF de preview generado',
    schema: {
      type: 'object',
      properties: {
        previewUrl: {
          type: 'string',
          description: 'URL firmada de S3 del PDF generado',
        },
      },
    },
  })
  async generatePreview(
    @Param('id') id: string
  ): Promise<{ previewUrl: string }> {
    const template = await this.pdfTemplateService.getTemplateById(id);
    if (!template) {
      throw new Error('Template not found');
    }

    // Generar preview usando el servicio correspondiente según el tipo de documento
    const previewUrl = await this.pdfTemplateService.generatePreview(template);

    // Retornar la URL del PDF (que es una URL firmada de S3)
    return { previewUrl };
  }
}


