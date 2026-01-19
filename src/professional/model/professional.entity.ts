import { Collection } from 'fireorm';
import { ProfessionalRole, MedicalProfessionalData } from 'src/shared/enums/professional-role.enum';

import { CommissionType } from './commission-type.enum';
import { ProfessionalType } from './professional-type.enum'; // Mantener para retrocompatibilidad

/**
 * Información personal del profesional
 */
export class PersonalInfo {
  name: string;
  idNumber: string;
  idType?: string; // DNI, RUT, CPF, etc.
  email: string;
  phone: string;
  profilePhoto?: string; // URL de la foto de perfil
  digitalSignature?: string; // URL o base64 de la firma digital
  notes?: string; // Notas adicionales
}

/**
 * Información profesional y de especialización
 */
export class ProfessionalInfo {
  role: ProfessionalRole; // CAMBIO: Rol unificado (antes: professionalType)
  professionalType?: ProfessionalType; // @deprecated: Mantener para retrocompatibilidad
  specialties?: string[]; // Especialidades o áreas de expertise
  servicesId?: string[]; // IDs de servicios que puede realizar
  license?: string; // Licencia/matrícula profesional
  licenseType?: string; // Tipo de licencia (CRM, etc.)
  licenseState?: string; // Estado de la licencia
}

/**
 * Información financiera y de comisiones
 */
export class FinancialInfo {
  commissionType?: CommissionType; // Tipo de comisión: PERCENTAGE o FIXED
  commissionValue?: number; // Valor del % o monto fijo
  paymentAccount?: {
    bank?: string;
    accountNumber?: string;
    accountType?: string;
    pixKey?: string; // Para Brasil
    holder?: string; // Titular de la cuenta
  };
}

/**
 * Entidad Professional
 * Representa a un profesional que ejecuta servicios en el negocio
 * Separado del concepto de Collaborator (quien registra en el sistema)
 */
@Collection('professional')
export class Professional {
  id: string;
  businessId: string; // Business al que pertenece
  commerceId?: string; // Commerce específico (opcional)
  commercesId?: string[]; // Lista de commerces donde puede trabajar

  // Información agrupada en objetos
  personalInfo: PersonalInfo; // Datos personales
  professionalInfo: ProfessionalInfo; // Datos profesionales
  financialInfo?: FinancialInfo; // Datos financieros (opcional)

  // Acceso directo a fotos (también en personalInfo)
  profilePhoto?: string; // URL de S3 para foto de perfil
  digitalSignature?: string; // URL de S3 para firma digital

  // Relación con Collaborator (NUEVO)
  isCollaborator: boolean; // Indica si tiene un Collaborator asociado (default: false)
  collaboratorId?: string; // ID del Collaborator asociado (si isCollaborator = true)

  // Rol del profesional (NUEVO - unificado)
  role: ProfessionalRole; // Rol unificado con Collaborator

  // Datos médicos profesionales (NUEVO - migrados desde Collaborator)
  medicalData?: MedicalProfessionalData; // Datos específicos para profesionales médicos

  // Estado y disponibilidad
  active: boolean; // Activo/Inactivo
  available: boolean; // Disponible para ser asignado

  // Auditoría
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string; // User ID que creó
  updatedBy?: string; // User ID que modificó
}
