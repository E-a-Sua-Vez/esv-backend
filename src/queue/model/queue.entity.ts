import { Collection } from 'fireorm';

import { Collaborator } from '../../collaborator/model/collaborator.entity';
import { Professional } from '../../professional/model/professional.entity';
import { Service } from '../../service/model/service.entity';

import { QueueType } from './queue-type.enum';

export class Block {
  number: number;
  hourFrom: string;
  hourTo: string;
}

export class ServiceInfo {
  sameCommeceHours: boolean;
  attentionDays: number[];
  attentionHourFrom: number;
  attentionHourTo: number;
  break: boolean;
  breakHourFrom: number;
  breakHourTo: number;
  blocks: Block[];
  blockLimit: number;
  personalized: boolean;
  walkin: boolean;
  personalizedHours: Record<number, PersonalizedHour>;
  holiday: boolean;
  holidays: Record<string, string[]>; // @deprecated: Use nonWorkingDates instead
  nonWorkingDates: string[]; // NEW: List of non-working dates in YYYY-MM-DD format
  specificCalendar: boolean;
  specificCalendarDays: Record<string, PersonalizedHour>;
}

class PersonalizedHour {
  attentionHourFrom: number;
  attentionHourTo: number;
}

@Collection('queue')
export class Queue {
  id: string;
  currentNumber: number;
  currentAttentionNumber: number;
  currentAttentionId: string;
  commerceId: string;
  type: QueueType;
  active: boolean;
  available: boolean;
  online: boolean;
  createdAt: Date;
  limit: number;
  name: string;
  tag: string;
  order: number;
  estimatedTime: number;
  blockTime: number;
  
  // CAMBIO: Queue ahora se relaciona con Professional en lugar de Collaborator
  professionalId?: string; // ID del Professional asignado
  professional?: Professional; // Professional asignado
  
  // @deprecated: Mantener para retrocompatibilidad durante la migración
  collaboratorId?: string; // DEPRECADO: Usar professionalId en su lugar
  collaborator?: Collaborator; // DEPRECADO: Usar professional en su lugar
  
  serviceId?: string;
  serviceInfo?: ServiceInfo;
  servicesId?: string[];
  services?: Service[];
  service?: Service;
  telemedicineEnabled?: boolean;
  presentialEnabled?: boolean;
}
