import {
  IsString,
  IsEmail,
  IsBoolean,
  IsOptional,
  IsArray,
  IsNumber,
  IsEnum,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProfessionalRole, MedicalProfessionalData } from 'src/shared/enums/professional-role.enum';

import { CommissionType } from '../model/commission-type.enum';

class PersonalInfoUpdateDto {
  @ApiPropertyOptional({ description: 'Nombre completo del profesional' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Número de identificación' })
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiPropertyOptional({ description: 'Tipo de documento' })
  @IsOptional()
  @IsString()
  idType?: string;

  @ApiPropertyOptional({ description: 'Email del profesional' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Teléfono del profesional' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'URL de la foto de perfil' })
  @IsOptional()
  @IsString()
  profilePhoto?: string;

  @ApiPropertyOptional({ description: 'URL o base64 de la firma digital' })
  @IsOptional()
  @IsString()
  digitalSignature?: string;

  @ApiPropertyOptional({ description: 'Notas adicionales' })
  @IsOptional()
  @IsString()
  notes?: string;
}

class ProfessionalInfoUpdateDto {
  @ApiPropertyOptional({ enum: ProfessionalRole, description: 'Rol del profesional (unificado)' })
  @IsOptional()
  @IsEnum(ProfessionalRole)
  role?: ProfessionalRole; // CAMBIO: De professionalType a role

  @ApiPropertyOptional({ enum: ProfessionalRole, description: 'Tipo de profesional (compatibilidad)' })
  @IsOptional()
  @IsEnum(ProfessionalRole)
  professionalType?: ProfessionalRole; // Aceptar ProfessionalRole para compatibilidad

  @ApiPropertyOptional({ description: 'Especialidades', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @ApiPropertyOptional({ description: 'IDs de servicios que puede realizar', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  servicesId?: string[];

  @ApiPropertyOptional({ description: 'Licencia o matrícula profesional' })
  @IsOptional()
  @IsString()
  license?: string;

  @ApiPropertyOptional({ description: 'Tipo de licencia' })
  @IsOptional()
  @IsString()
  licenseType?: string;

  @ApiPropertyOptional({ description: 'Estado de la licencia' })
  @IsOptional()
  @IsString()
  licenseState?: string;
}

class PaymentAccountUpdateDto {
  @ApiPropertyOptional({ description: 'Banco' })
  @IsOptional()
  @IsString()
  bank?: string;

  @ApiPropertyOptional({ description: 'Número de cuenta' })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiPropertyOptional({ description: 'Tipo de cuenta' })
  @IsOptional()
  @IsString()
  accountType?: string;

  @ApiPropertyOptional({ description: 'Clave PIX (Brasil)' })
  @IsOptional()
  @IsString()
  pixKey?: string;

  @ApiPropertyOptional({ description: 'Titular de la cuenta' })
  @IsOptional()
  @IsString()
  holder?: string;
}

class FinancialInfoUpdateDto {
  @ApiPropertyOptional({ enum: CommissionType, description: 'Tipo de comisión' })
  @IsOptional()
  @IsEnum(CommissionType)
  commissionType?: CommissionType;

  @ApiPropertyOptional({ description: 'Valor de comisión (% o monto fijo)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionValue?: number;

  @ApiPropertyOptional({ description: 'Datos de cuenta bancaria' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentAccountUpdateDto)
  paymentAccount?: PaymentAccountUpdateDto;
}

export class UpdateProfessionalDto {
  @ApiPropertyOptional({ description: 'ID del commerce específico' })
  @IsOptional()
  @IsString()
  commerceId?: string;

  @ApiPropertyOptional({ description: 'IDs de commerces donde puede trabajar', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  commercesId?: string[];

  @ApiPropertyOptional({ description: 'Información personal', type: PersonalInfoUpdateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalInfoUpdateDto)
  personalInfo?: PersonalInfoUpdateDto;

  @ApiPropertyOptional({ description: 'Información profesional', type: ProfessionalInfoUpdateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfessionalInfoUpdateDto)
  professionalInfo?: ProfessionalInfoUpdateDto;

  @ApiPropertyOptional({ description: 'Información financiera', type: FinancialInfoUpdateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FinancialInfoUpdateDto)
  financialInfo?: FinancialInfoUpdateDto;

  // NUEVOS CAMPOS: Relación con Collaborator
  @ApiPropertyOptional({ description: 'Indica si tiene Collaborator asociado' })
  @IsOptional()
  @IsBoolean()
  isCollaborator?: boolean;

  @ApiPropertyOptional({ description: 'ID del Collaborator asociado' })
  @IsOptional()
  @IsString()
  collaboratorId?: string;

  // NUEVOS CAMPOS: Datos médicos/profesionales
  @ApiPropertyOptional({ description: 'Datos médicos específicos' })
  @IsOptional()
  medicalData?: MedicalProfessionalData;

  @ApiPropertyOptional({ description: 'Estado activo' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Disponible para asignación' })
  @IsOptional()
  @IsBoolean()
  available?: boolean;
}
