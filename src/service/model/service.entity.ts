import { Collection } from 'fireorm';

import { ServiceType } from './service-type.enum';

export class ServiceInfo {
  price: number;
  currency: string;
  saving: number;
  onlinePrice: number;
  onlineSaving: number;
  shortDescription: string;
  longDescription: string;
  blockTime: number;
  estimatedTime: number;
  procedures: number;
  daysBetweenProcedures?: number; // Minimum days between sessions
  proceduresList?: string; // Comma-separated list of available procedure amounts (e.g., "3,10,20")
}

@Collection('service')
export class Service {
  id: string;
  commerceId: string;
  type: ServiceType;
  name: string;
  tag: string;
  active: boolean;
  online: boolean;
  createdAt: Date;
  order: number;
  serviceInfo: ServiceInfo;
  available: boolean;
  telemedicineEnabled?: boolean; // Enable/disable telemedicine for this service (default: false for backward compatibility)
  presentialEnabled?: boolean;   // Enable/disable presential attention for this service (default: true for backward compatibility)
}
