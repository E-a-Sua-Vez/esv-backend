import { Collection } from 'fireorm';

@Collection('booking-block-number-used')
export class BookingBlockNumberUsed {
    id: string;
    sessionId: string;
    blockNumber: number;
    queueId: string;
    date: string;
    hourFrom: string;
    hourTo: string;
    dateRequested: Date;
    time: number
}