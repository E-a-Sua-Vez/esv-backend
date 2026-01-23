import { Collection } from 'fireorm';
import { Service } from 'src/service/model/service.entity';
import { ProfessionalRole } from 'src/shared/enums/professional-role.enum';

import { CollaboratorType } from './collaborator-type.enum';

@Collection('collaborator')
export class Collaborator {
  id: string;
  name: string;
  lastName?: string; // Apellido del colaborador
  idNumber: string; // Documento de identidad (DNI, RUT, CPF, etc.) - OBLIGATORIO
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

  // Rol del colaborador (unificado con Professional)
  role: ProfessionalRole; // CAMBIO: Ahora es requerido y usa ProfessionalRole

  // Foto de perfil
  profilePhoto?: string; // URL de la foto de perfil del colaborador

  // Relación con Professional (NUEVO)
  isProfessional: boolean; // Indica si tiene un Professional asociado (default: false)
  professionalId?: string; // ID del Professional asociado (si isProfessional = true)

  // Metadatos
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
}
