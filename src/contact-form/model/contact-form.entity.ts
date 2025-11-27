import { Collection } from 'fireorm';

@Collection('contact-form')
export class ContactFormSubmission {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
  source: string; // 'contact-form' or 'exit-intent'
  page: string; // URL where the form was submitted
  eventId: string; // ID from the event store
  eventOccurredOn: Date; // When the event occurred
  createdAt: Date; // When the record was created in the database
  processedAt?: Date; // When the event was processed
  metadata?: {
    origin?: string;
    userAgent?: string;
    timestamp?: string;
  };
}
