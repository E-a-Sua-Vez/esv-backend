import { Collection } from 'fireorm';

@Collection('booking-block-numbers-used')
export class BookingBlockNumbersUsed {
    id: string;
    sessionId: string;
    blockNumber: number;
    queueId: string;
    date: string;
    dateRequested: Date;
    time: number
}