import { Collection } from 'fireorm';
import { ProductType } from './product-type.enum';
import { MeasureType } from './measure-type.enum';

export class ProductInfo {
    price: number;
    currency: string;
    lastReplacementBy: string;
    lastReplacementAmount: number;
    lastReplacementDate: Date;
    lastComsumptionBy: string;
    lastComsumptionAmount: number;
    lastComsumptionDate: Date;
    nextReplacementDate: Date;
}

@Collection('product')
export class Product {
    id: string;
    commerceId: string;
    type: ProductType;
    name: string;
    tag: string;
    code: string;
    measureType: MeasureType;
    actualLevel: number;
    minimumLevel: number;
    maximumLevel: number;
    optimumLevel: number;
    replacementLevel: number;
    productInfo: ProductInfo;
    active: boolean;
    online: boolean;
    createdAt: Date;
    order: number;
    available: boolean;
}