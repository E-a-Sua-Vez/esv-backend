import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsBoolean,
  IsOptional,
  IsArray,
  IsNumber,
  IsEnum,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProfessionalRole, MedicalProfessionalData } from 'src/shared/enums/professional-role.enum';

import { CommissionType } from '../model/commission-type.enum';

class PersonalInfoDto {
  @ApiProperty({ description: 'Nombre completo del profesional' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Número de identificación (DNI, RUT, CPF)' })
  @IsNotEmpty()
  @IsString()
  idNumber: string;

  @ApiPropertyOptional({ description: 'Tipo de documento' })
  @IsOptional()
  @IsString()
  idType?: string;

  @ApiProperty({ description: 'Email del profesional' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Teléfono del profesional' })
  @IsNotEmpty()
  @IsString()
  phone: string;

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

class ProfessionalInfoDto {
  @ApiProperty({ enum: ProfessionalRole, description: 'Rol del profesional (unificado)' })
  @IsNotEmpty()
  @IsEnum(ProfessionalRole)
  role: ProfessionalRole; // CAMBIO: De professionalType a role

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

class PaymentAccountDto {
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

class FinancialInfoDto {
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
  @Type(() => PaymentAccountDto)
  paymentAccount?: PaymentAccountDto;
}

export class CreateProfessionalDto {
  @ApiProperty({ description: 'ID del business' })
  @IsNotEmpty()
  @IsString()
  businessId: string;

  @ApiPropertyOptional({ description: 'ID del commerce específico' })
  @IsOptional()
  @IsString()
  commerceId?: string;

  @ApiPropertyOptional({ description: 'IDs de commerces donde puede trabajar', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  commercesId?: string[];

  @ApiProperty({ description: 'Información personal', type: PersonalInfoDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => PersonalInfoDto)
  personalInfo: PersonalInfoDto;

  @ApiProperty({ description: 'Información profesional', type: ProfessionalInfoDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ProfessionalInfoDto)
  professionalInfo: ProfessionalInfoDto;

  @ApiPropertyOptional({ description: 'Información financiera', type: FinancialInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FinancialInfoDto)
  financialInfo?: FinancialInfoDto;

  // NUEVOS CAMPOS: Relación con Collaborator
  @ApiPropertyOptional({ description: 'Indica si tiene Collaborator asociado', default: false })
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

  @ApiPropertyOptional({ description: 'Número de registro médico (CRM, CRO, etc.)' })
  @IsOptional()
  @IsString()
  crm?: string;

  @ApiPropertyOptional({ description: 'Estado/provincia del CRM' })
  @IsOptional()
  @IsString()
  crmState?: string;

  @ApiPropertyOptional({ description: 'Título profesional (Dr., Dra., Enf., etc.)' })
  @IsOptional()
  @IsString()
  professionalTitle?: string;

  @ApiPropertyOptional({ description: 'Departamento o área de trabajo' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Cargo específico' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ description: 'Email de trabajo' })
  @IsOptional()
  @IsEmail()
  workEmail?: string;

  @ApiPropertyOptional({ description: 'Contacto de emergencia' })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional({ description: 'Puede firmar documentos profesionales', default: false })
  @IsOptional()
  @IsBoolean()
  canSignDocuments?: boolean;

  @ApiPropertyOptional({ description: 'Texto personalizado para firma en documentos' })
  @IsOptional()
  @IsString()
  documentSignatureText?: string;

  @ApiPropertyOptional({ description: 'Estado activo', default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Disponible para asignación', default: true })
  @IsOptional()
  @IsBoolean()
  available?: boolean;
}
