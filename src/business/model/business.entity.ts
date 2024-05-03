import { Collection } from 'fireorm';
import { Country } from 'src/shared/model/country.enum';
import { Laguage } from 'src/shared/model/language.enum';
import { Commerce } from '../../commerce/model/commerce.entity';
import { Category } from './category.enum';

export class LocaleInfo {
    country: Country;
    language: Laguage;
    timezone: string;
    address: string;
    addressLat: number;
    addressLng: number;
}

export class ContactInfo {
    phone: string;
    phone2: string;
    email: string;
    url: string;
    whatsapp: string;
    twitter: string;
    facebook: string;
    instagram: string;
}

export class ServiceInfo {
    description: string;
    serviceUrl: string;
    attentionDays: number[];
    attentionHourFrom: number;
    attentionHourTo: number;
    break: boolean;
    breakHourFrom: number;
    breakHourTo: number;
    personalized: boolean;
    personalizedHours: Record<number, PersonalizedHour>;
    holiday: boolean;
    holidays: Record<string, string[]>;
}

class PersonalizedHour {
    attentionHourFrom: number;
    attentionHourTo: number;
}

export class WhatsappConnection {
    idConnection?: string;
    whatsapp?: string;
    lastConection?: Date;
    connected?: boolean;
    createdAt?: Date;
}

@Collection('business')
export class Business {
    id: string;
    name: string;
    keyName: string;
    active: boolean;
    planId: string;
    currentPlanActivationId: string;
    additionalFeatures: string[];
    country: string;
    localeInfo: LocaleInfo;
    contactInfo: ContactInfo;
    serviceInfo: ServiceInfo;
    whatsappConnection: WhatsappConnection;
    email: string;
    logo: string;
    phone: string;
    qr: string;
    commerces: Commerce[];
    url: string;
    createdAt: Date;
    category: Category;
    partnerId: string = 'N/A';
}
