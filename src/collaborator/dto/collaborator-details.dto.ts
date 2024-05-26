import { CollaboratorType } from '../model/collaborator-type.enum';
import { Service } from 'src/service/model/service.entity';

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
  services?: Service[]
}