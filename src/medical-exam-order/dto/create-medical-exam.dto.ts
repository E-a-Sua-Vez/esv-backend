import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, IsEnum } from 'class-validator';
import { ExamType } from '../model/exam-order-status.enum';

export class CreateMedicalExamDto {
  @ApiProperty({ description: 'ID del comercio al que pertenece el examen' })
  @IsString()
  commerceId: string; // ✅ Agregado

  @ApiProperty({ description: 'Nombre del examen' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Código LOINC', required: false })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ description: 'Tipo de examen', enum: ExamType })
  @IsEnum(ExamType)
  type: ExamType;

  @ApiProperty({ description: 'Categoría', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Descripción', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Preparación requerida', required: false })
  @IsOptional()
  @IsString()
  preparation?: string;

  @ApiProperty({ description: 'Duración estimada en minutos', required: false })
  @IsOptional()
  @IsNumber()
  estimatedDuration?: number;

  @ApiProperty({ description: 'Costo', required: false })
  @IsOptional()
  @IsNumber()
  cost?: number;

  @ApiProperty({ description: 'Activo', default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({ description: 'Disponible', default: true })
  @IsOptional()
  @IsBoolean()
  available?: boolean;
}





