import { Injectable } from '@nestjs/common';
import { NotificationClient } from './notification-client';
import { EmailInputDto } from '../model/email-input.dto';
const twilio = require('twilio');

@Injectable()
export class TwilioClient implements NotificationClient {

  private readonly client = new twilio();

  constructor() {};

  public async sendMessage(message: string, phone: string): Promise<any> {
    return this.client.messages
      .create({
        body: message,
        to: `whatsapp:+${phone}`,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SID
      })
      .then(message => {
        return message
      });
  }

  sendEmail(email: EmailInputDto): Promise<any> {
    throw new Error('Method not implemented.');
  }
}

