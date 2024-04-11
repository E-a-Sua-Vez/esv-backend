import { Collection } from 'fireorm';
import { ProductType } from './product-type.enum';
import { MeasureType } from './measure-type.enum';

export class ProductInfo {
    price: number;
    currency: string;
    lastReplacementId: string;
    lastReplacementBy: string;
    lastReplacementAmount: number;
    lastReplacementDate: Date;
    lastReplacementExpirationDate: Date;
    lastComsumptionId: string;
    lastComsumptionAttentionId: string;
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

@Collection('product-replacement')
export class ProductReplacement {
    id: string;
    productId: string;
    productCode: string;
    commerceId: string;
    code: string;
    price: number;
    currency: string;
    replacedBy: string;
    replacementAmount: number;
    replacementActualLevel: number;
    replacementDate: Date;
    replacementExpirationDate: Date;
    nextReplacementDate: Date;
    createdAt: Date;
}

@Collection('product-consumption')
export class ProductConsumption {
    id: string;
    productId: string;
    productCode: string;
    commerceId: string;
    comsumptionAttentionId: string;
    consumedBy: string;
    consumptionAmount: number;
    consumptionDate: Date;
    createdAt: Date;
}