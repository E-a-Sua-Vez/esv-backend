import { Collection } from 'fireorm';

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
    personalized: boolean;
    personalizedHours: Record<number, PersonalizedHour>;
    holiday: boolean;
    holidays: Record<string, string[]>;
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
    active: boolean;
    createdAt: Date;
    limit: number;
    name: string;
    order: number;
    estimatedTime: number;
    blockTime: number;
    serviceInfo: ServiceInfo;
}