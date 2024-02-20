import { Collection } from 'fireorm';
import { Queue } from 'src/queue/model/queue.entity';
import { Country } from 'src/shared/model/country.enum';
import { Laguage } from 'src/shared/model/language.enum';
import { FeatureToggle } from '../../feature-toggle/model/feature-toggle.entity';
import { Category } from './category.enum';
import { SurveyPersonalized } from '../../survey-personalized/model/survey-personalized.entity';

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

@Collection('commerce')
export class Commerce {
    id: string;
    name: string;
    keyName: string;
    tag: string;
    businessId: string;
    active: boolean;
    country: Country;
    localeInfo: LocaleInfo;
    contactInfo: ContactInfo;
    serviceInfo: ServiceInfo;
    email: string;
    logo: string;
    phone: string;
    qr: string;
    queues: Queue[];
    surveys: SurveyPersonalized[];
    features: FeatureToggle[];
    category: Category;
    url: string;
    createdAt: Date;
}
