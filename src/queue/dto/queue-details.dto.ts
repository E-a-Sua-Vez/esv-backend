import { Service } from 'src/service/model/service.entity';

import { QueueType } from '../model/queue-type.enum';
import { ServiceInfo } from '../model/queue.entity';

export class QueueDetailsDto {
  id: string;
  commerceId: string;
  collaboratorId: string;
  type: QueueType;
  active: boolean;
  available: boolean;
  online: boolean;
  limit: number;
  name: string;
  tag: string;
  order: number;
  estimatedTime: number;
  blockTime: number;
  serviceId: string;
  serviceInfo: ServiceInfo;
  servicesId: string[];
  services: Service[];
  telemedicineEnabled?: boolean;
  presentialEnabled?: boolean;
}
