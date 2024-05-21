import { Collection } from 'fireorm';
import { MessageType } from './type.enum';

@Collection('message')
export class Message {
    id: string;
    type: MessageType;
    commerceId: string;
    administratorId: string;
    collaboratorId: string;
    clientId: string;
    title: string;
    content: string;
    active: boolean;
    link: string;
    icon: string;
    available: boolean;
    read: boolean;
    createdAt: Date;
    readAt: Date;
}