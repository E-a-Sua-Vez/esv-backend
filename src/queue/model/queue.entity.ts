import { Collection } from 'fireorm';
import { QueueType } from './queue-type.enum';
import { Collaborator } from '../../collaborator/model/collaborator.entity';
import { Service } from '../../service/model/service.entity';

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
    walkin: boolean;
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
    type: QueueType;
    active: boolean;
    available: boolean;
    createdAt: Date;
    limit: number;
    name: string;
    tag: string;
    order: number;
    estimatedTime: number;
    blockTime: number;
    collaboratorId?: string;
    serviceId?: string;
    serviceInfo: ServiceInfo;
    collaborator: Collaborator;
    service: Service;
}