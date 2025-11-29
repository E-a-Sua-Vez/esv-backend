import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';

import { EmailInputDto, RawEmailInputDto } from '../model/email-input.dto';

import { NotificationClient } from './notification-client';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const MailComposer = require('nodemailer/lib/mail-composer');

@Injectable()
export class AwsClient implements NotificationClient {
  constructor() {
    AWS.config.update({ region: process.env.AWS_DEFAULT_REGION });
  }

  public async sendEmail(email: EmailInputDto): Promise<any> {
    const SES = new AWS.SES({ apiVersion: '2010-12-01' });
    if (email.FriendlyBase64Name) {
      email.Source = this.encodeSource(email.FriendlyBase64Name, email.Source);
      delete email.FriendlyBase64Name;
    }
    return await SES.sendTemplatedEmail(email).promise();
  }

  public async sendRawEmail(email: RawEmailInputDto): Promise<any> {
    // Ensure AWS config is updated before creating SES instance
    if (!AWS.config.region) {
      AWS.config.update({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
    }
    const SES = new AWS.SES({
      apiVersion: '2010-12-01',
      region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
    });

    // Use MailComposer to build the raw email message, then send via SES directly
    // This avoids the nodemailer SES transport compatibility issue
    const mail = new MailComposer(email);
    const message = await mail.compile().build();

    const params = {
      RawMessage: {
        Data: message,
      },
      Destinations: email.to,
    };

    return await SES.sendRawEmail(params).promise();
  }

  private encodeSource(base64Name: string, email: string): string {
    return `=?utf-8?B?${base64Name}?=<${email}>`;
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
  public async sendMessage(message: string, phone: string): Promise<any> {
    throw new Error('Method not implemented.');
  }
}
