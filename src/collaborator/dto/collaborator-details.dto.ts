import { Service } from 'src/service/model/service.entity';

import { CollaboratorType } from '../model/collaborator-type.enum';

export class CollaboratorDetailsDto {
  id: string;
  name: string;
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
  // Campos extendidos
  role?: string;
  profilePhoto?: string;
  digitalSignature?: string;
  crm?: string;
  crmState?: string;
  canSignDocuments?: boolean;
  medicalData?: any;
}
