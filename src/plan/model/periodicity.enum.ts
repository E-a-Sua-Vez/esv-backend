export enum Periodicity {
    weekly = 'weekly',
    biweekly = 'biweekly',
    monthly = 'monthly',
    quarterly = 'quarterly',
    biannual = 'biannual',
    annual = 'annual'
}

export const periodicityDayValues = {
    weekly: 7,
    biweekly: 15,
    monthly: 30,
    quarterly: 90,
    biannual: 180,
    annual: 365
}