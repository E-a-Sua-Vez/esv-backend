
import { Injectable } from "@nestjs/common";
import { NotificationClient } from './notification-client';
import * as AWS from 'aws-sdk';
import { EmailInputDto } from '../model/email-input.dto';

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

