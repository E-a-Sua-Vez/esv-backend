import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { MedicalProfessionalData, ProfessionalRole } from 'src/shared/enums/professional-role.enum';

import { CommissionType } from '../../professional/model/commission-type.enum';

/**
 * DTO para crear un Professional asociado a partir de un Collaborator existente
 * 
 * Este DTO permite:
 * 1. Crear un Professional usando los datos básicos del Collaborator
 * 2. Agregar información profesional adicional (comisiones, especialidades, etc.)
 * 3. Establecer la relación bidireccional Collaborator ↔ Professional
 */
export class CreateAssociatedProfessionalDto {
  @ApiPropertyOptional({ 
    enum: ProfessionalRole, 
    description: 'Rol profesional (si no se especifica, se toma del colaborador)' 
  })
  @IsOptional()
  role?: ProfessionalRole;

  @ApiPropertyOptional({ 
    description: 'Especialidades del profesional', 
    type: [String],
    example: ['Corte', 'Color', 'Peinado']
  })
  @IsOptional()
  specialties?: string[];

  @ApiPropertyOptional({ 
    description: 'IDs de servicios que puede realizar (si no se especifica, se toma del colaborador)', 
    type: [String] 
  })
  @IsOptional()
  servicesId?: string[];

  @ApiPropertyOptional({ 
    description: 'Licencia o matrícula profesional',
    example: 'CRM-12345'
  })
  @IsOptional()
  @IsString()
  license?: string;

  @ApiPropertyOptional({ 
    description: 'Tipo de licencia',
    example: 'CRM'
  })
  @IsOptional()
  @IsString()
  licenseType?: string;

  @ApiPropertyOptional({ 
    description: 'Estado de la licencia',
    example: 'SP'
  })
  @IsOptional()
  @IsString()
  licenseState?: string;

  // Información financiera
  @ApiPropertyOptional({ 
    enum: CommissionType, 
    description: 'Tipo de comisión: PERCENTAGE o FIXED' 
  })
  @IsOptional()
  commissionType?: CommissionType;

  @ApiPropertyOptional({ 
    description: 'Valor de comisión (% o monto fijo)',
    example: 30
  })
  @IsOptional()
  commissionValue?: number;

  @ApiPropertyOptional({ 
    description: 'Datos de cuenta bancaria para pagos',
    example: {
      bank: 'Banco do Brasil',
      accountNumber: '12345-6',
      accountType: 'Corrente',
      pixKey: 'email@example.com',
      holder: 'João Silva'
    }
  })
  @IsOptional()
  paymentAccount?: {
    bank?: string;
    accountNumber?: string;
    accountType?: string;
    pixKey?: string;
    holder?: string;
  };

  // Datos médicos/profesionales (si aplica)
  @ApiPropertyOptional({ 
    description: 'Datos médicos específicos (para profesionales de salud)' 
  })
  @IsOptional()
  medicalData?: MedicalProfessionalData;

  @ApiPropertyOptional({ 
    description: 'Número de registro médico (CRM, CRO, etc.)',
    example: 'CRM-123456'
  })
  @IsOptional()
  @IsString()
  crm?: string;

  @ApiPropertyOptional({ 
    description: 'Estado/provincia del CRM',
    example: 'SP'
  })
  @IsOptional()
  @IsString()
  crmState?: string;

  @ApiPropertyOptional({ 
    description: 'Título profesional (Dr., Dra., Enf., etc.)',
    example: 'Dr.'
  })
  @IsOptional()
  @IsString()
  professionalTitle?: string;

  @ApiPropertyOptional({ 
    description: 'Departamento o área de trabajo',
    example: 'Cardiología'
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ 
    description: 'Cargo específico',
    example: 'Médico Senior'
  })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ 
    description: 'Email de trabajo (diferente al personal)',
    example: 'trabajo@clinica.com'
  })
  @IsOptional()
  @IsString()
  workEmail?: string;

  @ApiPropertyOptional({ 
    description: 'Contacto de emergencia',
    example: '+55 11 98765-4321'
  })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional({ 
    description: 'Puede firmar documentos profesionales',
    default: false
  })
  @IsOptional()
  @IsBoolean()
  canSignDocuments?: boolean;

  @ApiPropertyOptional({ 
    description: 'Texto personalizado para firma en documentos',
    example: 'Dr. João Silva - CRM 12345'
  })
  @IsOptional()
  @IsString()
  documentSignatureText?: string;

  @ApiPropertyOptional({ 
    description: 'Disponible para ser asignado',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  available?: boolean;
}
