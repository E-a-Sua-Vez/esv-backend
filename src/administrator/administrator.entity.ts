import { Collection } from 'fireorm';

@Collection('administrator')
export class Administrator {
    id: string;
    name: string;
    active: boolean;
    businessId: string;
    commerceIds: [string];
    rolId: string;
    email: string;
    password: string;
    token: string;
    lastSignIn: Date;
    firstPasswordChanged: boolean;
    lastPasswordChanged: Date;
    master: boolean;
    permissions: Record<string, boolean|number>;
}