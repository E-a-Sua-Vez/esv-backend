import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsDateString,
  IsOptional,
  ValidateNested,
} from 'class-validator';

import { ExamType, ExamPriority } from '../model/exam-order-status.enum';

export class ExamItemDto {
  @ApiProperty({ description: 'ID del examen', example: 'exam-123' })
  @IsNotEmpty()
  @IsString()
  examId: string;

  @ApiProperty({ description: 'Nombre del examen', example: 'Hemograma completo' })
  @IsNotEmpty()
  @IsString()
  examName: string;

  @ApiProperty({ description: 'Código del examen', required: false })
  @IsOptional()
  @IsString()
  examCode?: string;

  @ApiProperty({ description: 'Preparación requerida', required: false })
  @IsOptional()
  @IsString()
  preparation?: string;

  @ApiProperty({ description: 'Instrucciones especiales', required: false })
  @IsOptional()
  @IsString()
  instructions?: string;
}

export class CreateExamOrderDto {
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

  @ApiProperty({ description: 'ID del colaborador que emite (DEPRECATED: usar professionalId)', required: false, deprecated: true })
  @IsOptional()
  @IsString()
  collaboratorId?: string;

  @ApiProperty({ description: 'ID del profesional que emite la orden', required: false })
  @IsOptional()
  @IsString()
  professionalId?: string;

  @ApiProperty({ description: 'Lista de exámenes', type: [ExamItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamItemDto)
  exams: ExamItemDto[];

  @ApiProperty({ description: 'Tipo de examen', enum: ExamType, example: ExamType.LABORATORY })
  @IsNotEmpty()
  type: ExamType;

  @ApiProperty({ description: 'Prioridad', enum: ExamPriority, example: ExamPriority.ROUTINE })
  @IsNotEmpty()
  priority: ExamPriority;

  @ApiProperty({ description: 'Justificación clínica', required: false })
  @IsOptional()
  @IsString()
  clinicalJustification?: string;

  @ApiProperty({ description: 'Fecha programada', required: false })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiProperty({ description: 'ID del laboratorio', required: false })
  @IsOptional()
  @IsString()
  laboratoryId?: string;

  @ApiProperty({ description: 'Nombre del laboratorio', required: false })
  @IsOptional()
  @IsString()
  laboratoryName?: string;

  @ApiProperty({ description: 'Número de orden para HL7', required: false })
  @IsOptional()
  @IsString()
  hl7OrderNumber?: string;

  @ApiProperty({ description: 'ID de paciente para HL7', required: false })
  @IsOptional()
  @IsString()
  hl7PatientId?: string;
}
