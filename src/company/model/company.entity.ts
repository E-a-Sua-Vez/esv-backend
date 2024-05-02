import { Collection } from 'fireorm';
import { CompanyType } from './company-type.enum';

export class CompanyInfo {}

@Collection('company')
export class Company {
    id: string;
    commerceId: string;
    type: CompanyType;
    name: string;
    tag: string;
    active: boolean;
    online: boolean;
    createdAt: Date;
    order: number;
    companyInfo: CompanyInfo;
    available: boolean;
}