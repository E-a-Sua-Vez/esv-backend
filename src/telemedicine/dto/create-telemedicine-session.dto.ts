import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  MaxLength,
} from 'class-validator';

import { TelemedicineSessionType } from '../model/telemedicine-session.entity';

export class CreateTelemedicineSessionDto {
  @ApiProperty({ description: 'ID del comercio' })
  @IsNotEmpty()
  @IsString()
  commerceId: string;

  @ApiProperty({ description: 'ID del paciente' })
  @IsNotEmpty()
  @IsString()
  clientId: string;

  @ApiProperty({ description: 'ID del médico' })
  @IsNotEmpty()
  @IsString()
  doctorId: string;

  @ApiPropertyOptional({ description: 'ID de la atención (si existe)' })
  @IsOptional()
  @IsString()
  attentionId?: string;

  @ApiPropertyOptional({ description: 'ID del historial médico' })
  @IsOptional()
  @IsString()
  patientHistoryId?: string;

  @ApiProperty({
    description: 'Tipo de sesión',
    enum: TelemedicineSessionType,
    default: TelemedicineSessionType.BOTH,
  })
  @IsEnum(TelemedicineSessionType)
  type: TelemedicineSessionType;

  @ApiProperty({ description: 'Fecha y hora programada' })
  @IsNotEmpty()
  @IsDateString()
  scheduledAt: Date;

  @ApiPropertyOptional({ description: 'Habilitar grabación', default: false })
  @IsOptional()
  @IsBoolean()
  recordingEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Notas previas', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000) // Limit notes length
  notes?: string;
}
