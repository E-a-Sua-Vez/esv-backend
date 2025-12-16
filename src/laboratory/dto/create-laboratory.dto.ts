import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEmail, IsObject } from 'class-validator';

export class CreateLaboratoryDto {
  @ApiProperty({ description: 'Nombre del laboratorio' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Código único del laboratorio' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'ID del comercio asociado' })
  @IsOptional()
  @IsString()
  commerceId?: string;

  @ApiPropertyOptional({ description: 'ID del negocio asociado' })
  @IsOptional()
  @IsString()
  businessId?: string;

  @ApiPropertyOptional({ description: 'Email de contacto' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Teléfono de contacto' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Dirección' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ description: 'Habilitado para HL7', default: false })
  @IsBoolean()
  hl7Enabled: boolean;

  @ApiPropertyOptional({ description: 'API Key para HL7' })
  @IsOptional()
  @IsString()
  hl7ApiKey?: string;

  @ApiPropertyOptional({ description: 'Endpoint HL7' })
  @IsOptional()
  @IsString()
  hl7Endpoint?: string;

  @ApiPropertyOptional({ description: 'Tipo de integración', enum: ['hl7', 'api', 'manual'] })
  @IsOptional()
  @IsString()
  integrationType?: 'hl7' | 'api' | 'manual';
}
