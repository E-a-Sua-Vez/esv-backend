import { Collection } from 'fireorm';
import { Service } from 'src/service/model/service.entity';

import { CollaboratorType } from './collaborator-type.enum';
import { CollaboratorRole, MedicalCollaboratorData } from './collaborator-roles.enum';

@Collection('collaborator')
export class Collaborator {
  id: string;
  name: string;
  lastName?: string; // Apellido del colaborador
  active: boolean;
  commerceId: string;
  commercesId: string[];
  type: CollaboratorType;
  administratorId: string;
  alias: string;
  email: string;
  phone: string;
  moduleId: string;
  token: string;
  lastSignIn: Date;
  bot: boolean;
  firstPasswordChanged: boolean;
  lastPasswordChanged: Date;
  servicesId: string[];
  permissions: Record<string, boolean | number>;
  available: boolean;
  services?: Service[];

  // Campos existentes de firma digital (mantener compatibilidad)
  digitalSignature?: string; // URL o base64 de la imagen de firma digital
  crm?: string; // Número de registro médico (CRM)
  crmState?: string; // Estado del CRM (ej: SP, RJ, MG)

  // NUEVOS CAMPOS PARA EXTENSIÓN MÉDICA (todos opcionales para retrocompatibilidad)

  // Foto de perfil
  profilePhoto?: string; // URL de la foto de perfil del colaborador

  // Datos médicos profesionales (para médicos y personal médico)
  medicalData?: MedicalCollaboratorData;

  // Rol específico (mantener type para retrocompatibilidad)
  role?: CollaboratorRole; // Rol específico médico

  // Información profesional general
  professionalTitle?: string; // Dr., Dra., Enf., etc.
  department?: string; // Departamento o área de trabajo
  position?: string; // Cargo específico

  // Datos de contacto adicionales
  workEmail?: string; // Email de trabajo (diferente al personal)
  emergencyContact?: string; // Contacto de emergencia

  // Configuraciones
  canSignDocuments?: boolean; // Puede firmar documentos médicos
  documentSignatureText?: string; // Texto personalizado para firma en documentos

  // Metadatos
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
}
