import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsDateString,
  IsEnum,
  ValidateNested,
  IsNumber,
} from 'class-validator';

export class ExamValueDto {
  @ApiProperty({ description: 'Nombre del parámetro' })
  @IsNotEmpty()
  @IsString()
  parameter: string;

  @ApiProperty({ description: 'Valor del parámetro' })
  @IsNotEmpty()
  value: string | number;

  @ApiPropertyOptional({ description: 'Unidad de medida' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: 'Rango de referencia' })
  @IsOptional()
  @IsString()
  referenceRange?: string;

  @ApiPropertyOptional({
    description: 'Estado del valor',
    enum: ['normal', 'high', 'low', 'critical'],
  })
  @IsOptional()
  @IsEnum(['normal', 'high', 'low', 'critical'])
  status?: 'normal' | 'high' | 'low' | 'critical';

  @ApiPropertyOptional({ description: 'Código LOINC del parámetro' })
  @IsOptional()
  @IsString()
  loincCode?: string;
}

export class CreateExamResultDto {
  @ApiProperty({ description: 'ID de la orden de examen' })
  @IsNotEmpty()
  @IsString()
  examOrderId: string;

  @ApiProperty({ description: 'Nombre del examen' })
  @IsNotEmpty()
  @IsString()
  examName: string;

  @ApiPropertyOptional({ description: 'Código del examen (LOINC)' })
  @IsOptional()
  @IsString()
  examCode?: string;

  @ApiPropertyOptional({ description: 'Fecha de realización del examen' })
  @IsOptional()
  @IsDateString()
  performedAt?: Date;

  @ApiProperty({ description: 'Fecha del resultado' })
  @IsNotEmpty()
  @IsDateString()
  resultDate: Date;

  @ApiProperty({ description: 'Valores del examen', type: [ExamValueDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamValueDto)
  values: ExamValueDto[];

  @ApiPropertyOptional({ description: 'Observaciones' })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional({ description: 'Interpretación del médico' })
  @IsOptional()
  @IsString()
  interpretation?: string;

  @ApiPropertyOptional({
    description: 'Estado del resultado',
    enum: ['preliminary', 'final', 'corrected'],
  })
  @IsOptional()
  @IsEnum(['preliminary', 'final', 'corrected'])
  status?: 'preliminary' | 'final' | 'corrected';

  @ApiPropertyOptional({ description: 'URLs de documentos adjuntos' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @ApiPropertyOptional({ description: 'Rango normal general' })
  @IsOptional()
  @IsString()
  normalRange?: string;
}
