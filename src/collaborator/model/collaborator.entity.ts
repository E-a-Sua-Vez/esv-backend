import { Collection } from 'fireorm';

@Collection('collaborator')
export class Collaborator {
    id: string;
    name: string;
    active: boolean;
    commerceId: string;
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
}