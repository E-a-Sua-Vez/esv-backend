import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsObject,
  ValidateNested,
  IsBoolean,
} from 'class-validator';

import { ExamParameter, NormalRange, CriticalValue } from '../model/exam-result-template.entity';

export class ExamParameterDto {
  @ApiProperty({ description: 'Nombre del parámetro' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Código LOINC del parámetro' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ description: 'Unidad de medida' })
  @IsNotEmpty()
  @IsString()
  unit: string;

  @ApiProperty({ description: 'Tipo de dato', enum: ['numeric', 'text', 'boolean', 'date'] })
  @IsNotEmpty()
  @IsString()
  dataType: 'numeric' | 'text' | 'boolean' | 'date';

  @ApiProperty({ description: 'Si el parámetro es requerido' })
  @IsNotEmpty()
  @IsBoolean()
  required: boolean;

  @ApiProperty({ description: 'Orden de visualización' })
  @IsNotEmpty()
  order: number;
}

export class NormalRangeDto {
  @ApiPropertyOptional({ description: 'Valor mínimo' })
  @IsOptional()
  min?: number;

  @ApiPropertyOptional({ description: 'Valor máximo' })
  @IsOptional()
  max?: number;

  @ApiPropertyOptional({ description: 'Valor mínimo (texto)' })
  @IsOptional()
  @IsString()
  minText?: string;

  @ApiPropertyOptional({ description: 'Valor máximo (texto)' })
  @IsOptional()
  @IsString()
  maxText?: string;

  @ApiPropertyOptional({ description: 'Género aplicable', enum: ['male', 'female', 'both'] })
  @IsOptional()
  @IsString()
  gender?: 'male' | 'female' | 'both';

  @ApiPropertyOptional({ description: 'Edad mínima' })
  @IsOptional()
  ageMin?: number;

  @ApiPropertyOptional({ description: 'Edad máxima' })
  @IsOptional()
  ageMax?: number;

  @ApiPropertyOptional({ description: 'Condición especial' })
  @IsOptional()
  @IsString()
  condition?: string;
}

export class CriticalValueDto {
  @ApiProperty({ description: 'Tipo de valor crítico', enum: ['high', 'low'] })
  @IsNotEmpty()
  @IsString()
  type: 'high' | 'low';

  @ApiPropertyOptional({ description: 'Valor numérico crítico' })
  @IsOptional()
  value?: number;

  @ApiPropertyOptional({ description: 'Valor crítico (texto)' })
  @IsOptional()
  @IsString()
  valueText?: string;

  @ApiProperty({ description: 'Nivel de alerta', enum: ['warning', 'critical'] })
  @IsNotEmpty()
  @IsString()
  alertLevel: 'warning' | 'critical';

  @ApiPropertyOptional({ description: 'Mensaje de alerta' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class CreateExamResultTemplateDto {
  @ApiProperty({ description: 'Código del examen (LOINC)' })
  @IsNotEmpty()
  @IsString()
  examCode: string;

  @ApiProperty({ description: 'Nombre del examen' })
  @IsNotEmpty()
  @IsString()
  examName: string;

  @ApiPropertyOptional({ description: 'Tipo de examen' })
  @IsOptional()
  @IsString()
  examType?: string;

  @ApiProperty({ description: 'Parámetros del examen', type: [ExamParameterDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamParameterDto)
  parameters: ExamParameterDto[];

  @ApiPropertyOptional({ description: 'Rangos normales por parámetro' })
  @IsOptional()
  @IsObject()
  normalRanges?: Record<string, NormalRangeDto>;

  @ApiPropertyOptional({ description: 'Valores críticos por parámetro' })
  @IsOptional()
  @IsObject()
  criticalValues?: Record<string, CriticalValueDto>;

  @ApiPropertyOptional({ description: 'ID del comercio' })
  @IsOptional()
  @IsString()
  commerceId?: string;

  @ApiPropertyOptional({ description: 'ID del negocio' })
  @IsOptional()
  @IsString()
  businessId?: string;
}
