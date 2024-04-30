import { Collection } from 'fireorm';
import { PaymentMethod } from 'src/payment/model/payment-method.enum';
import { PaymentConfirmation } from '../../payment/model/payment-confirmation';
import { OutcomeStatus } from './outcome-status.enum';

export class OutcomeInfo {
    user: String
}

@Collection('outcome')
export class Outcome {
    id: string;
    commerceId: string;
    bookingId: string;
    attentionId: string;
    clientId: string;
    packageId: string;
    type: string;
    amount: number;
    totalAmount: number;
    installments: number;
    paymentMethod: PaymentMethod;
    commission: number;
    comment: string;
    fiscalNote: string;
    promotionalCode: string;
    transactionId: string;
    bankEntity: string;
    discountAmount: number;
    discountPercentage: number;
    paid: boolean;
    typeName: string;
    paymentConfirmation: PaymentConfirmation;
    outcomeInfo: OutcomeInfo;
    status: OutcomeStatus;
    createdAt: Date;
    paidAt: Date;
    paidBy: string;
    cancelledAt: Date;
    cancelledBy: string;
    createdBy: string;
    paymentType: string;
    paymentAmount: string;
    quantity: string;
    title: string;
    productId: string;
    productName: string;
    beneficiary: string;
    date: Date;
    code: string;
    expireDate: Date;
}