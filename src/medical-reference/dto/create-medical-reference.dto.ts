import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDateString, IsOptional, IsEnum } from 'class-validator';

import { ReferenceUrgency } from '../model/medical-reference.entity';

export class CreateMedicalReferenceDto {
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

  @ApiProperty({ description: 'ID del médico origen', example: 'doctor-123' })
  @IsNotEmpty()
  @IsString()
  doctorOriginId: string;

  @ApiProperty({ description: 'Nombre del médico origen', example: 'Dr. Juan Pérez' })
  @IsNotEmpty()
  @IsString()
  doctorOriginName: string;

  @ApiProperty({ description: 'ID del médico destino', required: false })
  @IsOptional()
  @IsString()
  doctorDestinationId?: string;

  @ApiProperty({ description: 'Nombre del médico destino', required: false })
  @IsOptional()
  @IsString()
  doctorDestinationName?: string;

  @ApiProperty({ description: 'Especialidad destino', example: 'Cardiología' })
  @IsNotEmpty()
  @IsString()
  specialtyDestination: string;

  @ApiProperty({ description: 'Motivo de la referencia', example: 'Evaluación cardiológica' })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({ description: 'Diagnóstico presuntivo', required: false })
  @IsOptional()
  @IsString()
  presumptiveDiagnosis?: string;

  @ApiProperty({ description: 'Estudios realizados', required: false })
  @IsOptional()
  @IsString()
  studiesPerformed?: string;

  @ApiProperty({ description: 'Tratamiento actual', required: false })
  @IsOptional()
  @IsString()
  currentTreatment?: string;

  @ApiProperty({
    description: 'Urgencia',
    enum: ReferenceUrgency,
    example: ReferenceUrgency.ROUTINE,
  })
  @IsNotEmpty()
  @IsEnum(ReferenceUrgency)
  urgency: ReferenceUrgency;

  @ApiProperty({ description: 'Documentos adjuntos', required: false, type: [String] })
  @IsOptional()
  attachedDocuments?: string[];
}
