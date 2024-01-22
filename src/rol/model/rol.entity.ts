import { Collection } from 'fireorm';

@Collection('rol')
export class Rol {
    id: string;
    name: string;
    description: string;
    active: boolean;
    permissions: Record<string, boolean|number>;
    createdAt: Date;
    modifiedAt: Date;
}