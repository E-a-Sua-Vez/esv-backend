import { Collection } from 'fireorm';

@Collection('module')
export class Module {
    id: string;
    name: string;
    commerceId: string;
    active: boolean;
    createdAt: Date;
    available: boolean;
}