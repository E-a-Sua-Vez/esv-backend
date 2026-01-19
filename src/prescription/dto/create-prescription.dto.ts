import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsDateString,
  IsOptional,
  IsNumber,
  ValidateNested,
} from 'class-validator';

export class MedicationItemDto {
  @ApiProperty({ description: 'ID del medicamento en el catálogo', example: 'med-123' })
  @IsNotEmpty()
  @IsString()
  medicationId: string;

  @ApiProperty({ description: 'Nombre del medicamento', example: 'Paracetamol' })
  @IsNotEmpty()
  @IsString()
  medicationName: string;

  @ApiProperty({ description: 'Nombre comercial', required: false, example: 'Tylenol' })
  @IsOptional()
  @IsString()
  commercialName?: string;

  @ApiProperty({ description: 'Dosis', example: '500mg' })
  @IsNotEmpty()
  @IsString()
  dosage: string;

  @ApiProperty({ description: 'Frecuencia', example: 'cada 8 horas' })
  @IsNotEmpty()
  @IsString()
  frequency: string;

  @ApiProperty({ description: 'Duración en días', example: 7 })
  @IsNotEmpty()
  @IsNumber()
  duration: number;

  @ApiProperty({ description: 'Cantidad total', example: 21 })
  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @ApiProperty({ description: 'Vía de administración', example: 'oral' })
  @IsNotEmpty()
  @IsString()
  route: string;

  @ApiProperty({ description: 'Indicaciones especiales', required: false })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiProperty({ description: 'Número de refuerzos permitidos', example: 2 })
  @IsNotEmpty()
  @IsNumber()
  refillsAllowed: number;
}

export class CreatePrescriptionDto {
  @ApiProperty({ description: 'ID del comercio', example: 'commerce-123' })
  @IsNotEmpty()
  @IsString()
  commerceId: string;

  @ApiProperty({ description: 'ID del cliente/paciente', example: 'client-123' })
  @IsNotEmpty()
  @IsString()
  clientId: string;

  @ApiProperty({ description: 'ID de la atención asociada', example: 'attention-123' })
  @IsNotEmpty()
  @IsString()
  attentionId: string;

  @ApiProperty({ description: 'ID del prontuario asociado', required: false })
  @IsOptional()
  @IsString()
  patientHistoryId?: string;

  @ApiProperty({ description: 'ID del médico', example: 'doctor-123' })
  @IsNotEmpty()
  @IsString()
  doctorId: string;

  @ApiProperty({ description: 'Nombre del médico', example: 'Dr. Juan Pérez' })
  @IsNotEmpty()
  @IsString()
  doctorName: string;

  @ApiProperty({ description: 'Número de licencia médica', required: false })
  @IsOptional()
  @IsString()
  doctorLicense?: string;

  @ApiProperty({ description: 'ID del colaborador que emite (DEPRECATED: usar professionalId)', required: false, deprecated: true })
  @IsOptional()
  @IsString()
  collaboratorId?: string;

  @ApiProperty({ description: 'ID del profesional que emite la prescripción', required: false })
  @IsOptional()
  @IsString()
  professionalId?: string;

  @ApiProperty({ description: 'Lista de medicamentos', type: [MedicationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicationItemDto)
  medications: MedicationItemDto[];

  @ApiProperty({ description: 'Fecha de la receta', example: '2024-01-15T10:00:00Z' })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Fecha de validez', example: '2024-01-30T10:00:00Z' })
  @IsNotEmpty()
  @IsDateString()
  validUntil: string;

  @ApiProperty({ description: 'Observaciones', required: false })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiProperty({ description: 'Instrucciones generales', required: false })
  @IsOptional()
  @IsString()
  instructions?: string;
}
