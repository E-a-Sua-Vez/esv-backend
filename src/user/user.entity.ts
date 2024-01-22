import { Collection } from 'fireorm';

@Collection('user')
export class User {
    id: string;
    frequentCustomer: boolean;
    idNumber: string;
    name: string;
    lastName: string;
    email: string;
    phone: string;
    commerceId: string;
    queueId: string;
    country: string;
    createdAt: Date;
    notificationOn: boolean = false;
    notificationEmailOn: boolean = false;
    updatedAt: Date;
}