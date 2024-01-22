import { Collection } from 'fireorm';
import { Periodicity } from './periodicity.enum';

@Collection('plan')
export class Plan {
    id: string;
    name: string;
    description: string;
    country: string;
    online: boolean;
    active: boolean;
    currency: string;
    price: number;
    saving: number;
    onlinePrice: number;
    onlineSaving: number;
    periodicity: Periodicity;
    order: number;
    createdAt: Date;
    modifiedAt: Date;
    permissions: Record<string, boolean|number>;
}