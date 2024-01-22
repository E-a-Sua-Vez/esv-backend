import { Collection } from 'fireorm';
import { BankAccount } from './bank-account';
import { PaymentMethod } from './payment-method.enum';

@Collection('payment')
export class Payment {
    id: string;
    planId: string;
    businessId: string;
    amount: number;
    paymentNumber: string;
    paymentDate: Date;
    bankData: BankAccount;
    method: PaymentMethod;
    createdAt: Date;
}