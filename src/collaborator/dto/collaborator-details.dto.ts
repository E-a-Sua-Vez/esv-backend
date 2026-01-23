import { Service } from 'src/service/model/service.entity';
import { ProfessionalRole } from 'src/shared/enums/professional-role.enum';

import { CollaboratorType } from '../model/collaborator-type.enum';

export class CollaboratorDetailsDto {
  id: string;
  name: string;
  lastName?: string;
  idNumber: string; // Documento de identidad - OBLIGATORIO
  active: boolean;
  commerceId: string;
  commercesId: string[];
  type: CollaboratorType;
  alias: string;
  moduleId: string;
  bot: boolean;
  servicesId: string[];
  available: boolean;
  services?: Service[];
  
  // Campos de contacto básicos
  email?: string;
  phone?: string;
  
  // Rol (unificado con Professional)
  role: ProfessionalRole; // CAMBIO: Ahora es requerido y usa ProfessionalRole
  
  // Foto de perfil
  profilePhoto?: string;
  
  // Relación con Professional (NUEVO)
  isProfessional?: boolean; // Indica si tiene Professional asociado
  professionalId?: string; // ID del Professional asociado
  
  // Firma digital (opcional)
  digitalSignature?: string;
  canSignDocuments?: boolean;
  
  // CRM data (opcional)
  crm?: any;
  crmState?: any;
  
  // Medical data (opcional)
  medicalData?: any;
}
