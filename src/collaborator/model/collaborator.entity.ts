import { Collection } from 'fireorm';
import { CollaboratorType } from './collaborator-type.enum';

@Collection('collaborator')
export class Collaborator {
    id: string;
    name: string;
    active: boolean;
    commerceId: string;
    commercesId: string[];
    type: CollaboratorType;
    administratorId: string;
    alias: string;
    email: string;
    phone: string;
    moduleId: string;
    token: string;
    lastSignIn: Date;
    bot: boolean;
    firstPasswordChanged: boolean;
    lastPasswordChanged: Date;
    servicesId: string[];
    permissions: Record<string, boolean|number>;
    available: boolean;
}