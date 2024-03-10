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
}