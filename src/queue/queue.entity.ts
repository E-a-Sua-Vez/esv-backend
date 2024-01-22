import { Collection } from 'fireorm';

export class ServiceInfo {
    attentionDays: number[];
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
    active: boolean;
    createdAt: Date;
    limit: number;
    name: string;
    order: number;
    estimatedTime: number;
    serviceInfo: ServiceInfo;
}