import { Injectable } from '@nestjs/common';

import { EmailInputDto, RawEmailInputDto } from '../model/email-input.dto';

import { NotificationClient } from './notification-client';

const twilio = require('twilio');

@Injectable()
export class TwilioClient implements NotificationClient {
  private readonly client = new twilio();

  constructor() {}

  public async sendMessage(message: string, phone: string): Promise<any> {
    return this.client.messages
      .create({
        body: message,
        to: `whatsapp:+${phone}`,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SID,
      })
      .then(message => {
        return message;
      });
  }
  sendEmail(email: EmailInputDto): Promise<any> {
    throw new Error('Method not implemented.');
  }
  sendRawEmail(data: RawEmailInputDto): Promise<any> {
    throw new Error('Method not implemented.');
  }
  disconnectService(): Promise<any> {
    throw new Error('Method not implemented.');
  }
  requestServiceStatus(serviceId: string): Promise<any> {
    throw new Error('Method not implemented.');
  }
  requestEvent(): Promise<any> {
    throw new Error('Method not implemented.');
  }
  requestConnection(): Promise<any> {
    throw new Error('Method not implemented.');
  }
}
