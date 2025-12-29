import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsBoolean, IsObject, ValidateNested } from 'class-validator';

import { PdfTemplateSection } from '../model/pdf-template.entity';

export class CreatePdfTemplateSectionDto {
  @ApiProperty({ description: 'Tipo de sección', enum: ['header', 'footer', 'content'] })
  @IsEnum(['header', 'footer', 'content'])
  type: 'header' | 'footer' | 'content';

  @ApiProperty({ description: 'Si la sección está habilitada', required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'HTML personalizado', required: false })
  @IsOptional()
  @IsString()
  html?: string;

  @ApiProperty({ description: 'Texto simple', required: false })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiProperty({ description: 'Posición', required: false })
  @IsOptional()
  @IsString()
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';

  @ApiProperty({ description: 'Tamaño de fuente', required: false })
  @IsOptional()
  fontSize?: number;

  @ApiProperty({ description: 'Familia de fuente', required: false })
  @IsOptional()
  @IsString()
  fontFamily?: string;

  @ApiProperty({ description: 'Color', required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ description: 'Alineación', required: false })
  @IsOptional()
  @IsString()
  alignment?: 'left' | 'center' | 'right';

  @ApiProperty({ description: 'Márgenes', required: false })
  @IsOptional()
  @IsObject()
  margin?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };

  @ApiProperty({ description: 'Incluir logo', required: false })
  @IsOptional()
  @IsBoolean()
  includeLogo?: boolean;

  @ApiProperty({ description: 'Incluir info del commerce', required: false })
  @IsOptional()
  @IsBoolean()
  includeCommerceInfo?: boolean;

  @ApiProperty({ description: 'Incluir info del médico', required: false })
  @IsOptional()
  @IsBoolean()
  includeDoctorInfo?: boolean;

  @ApiProperty({ description: 'Incluir fecha', required: false })
  @IsOptional()
  @IsBoolean()
  includeDate?: boolean;

  @ApiProperty({ description: 'Incluir QR code', required: false })
  @IsOptional()
  @IsBoolean()
  includeQrCode?: boolean;

  @ApiProperty({ description: 'Incluir firma digital', required: false })
  @IsOptional()
  @IsBoolean()
  includeDigitalSignature?: boolean;
}

export class CreatePdfTemplateDto {
  @ApiProperty({ description: 'Nombre del template' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Descripción', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Tipo de documento', enum: ['prescription', 'exam_order', 'reference'] })
  @IsEnum(['prescription', 'exam_order', 'reference'])
  documentType: 'prescription' | 'exam_order' | 'reference';

  @ApiProperty({ description: 'ID del commerce (opcional)', required: false })
  @IsOptional()
  @IsString()
  commerceId?: string;

  @ApiProperty({ description: 'Alcance', enum: ['GLOBAL', 'COMMERCE', 'PERSONAL'] })
  @IsEnum(['GLOBAL', 'COMMERCE', 'PERSONAL'])
  scope: 'GLOBAL' | 'COMMERCE' | 'PERSONAL';

  @ApiProperty({ description: 'Si está activo', required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({ description: 'Si está disponible', required: false })
  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @ApiProperty({ description: 'Sección header', required: false, type: CreatePdfTemplateSectionDto })
  @IsOptional()
  @ValidateNested()
  header?: CreatePdfTemplateSectionDto;

  @ApiProperty({ description: 'Sección footer', required: false, type: CreatePdfTemplateSectionDto })
  @IsOptional()
  @ValidateNested()
  footer?: CreatePdfTemplateSectionDto;

  @ApiProperty({ description: 'Sección content', required: false, type: CreatePdfTemplateSectionDto })
  @IsOptional()
  @ValidateNested()
  content?: CreatePdfTemplateSectionDto;

  @ApiProperty({ description: 'Variables disponibles', required: false })
  @IsOptional()
  variables?: string[];

  @ApiProperty({ description: 'Tamaño de página', required: false })
  @IsOptional()
  @IsString()
  pageSize?: 'A4' | 'LETTER' | 'A5' | 'LETTER_HALF';

  @ApiProperty({ description: 'Márgenes', required: false })
  @IsOptional()
  @IsObject()
  margins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };

  @ApiProperty({ description: 'Orientación', required: false })
  @IsOptional()
  @IsString()
  orientation?: 'portrait' | 'landscape';

  @ApiProperty({ description: 'Si es template por defecto', required: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}






