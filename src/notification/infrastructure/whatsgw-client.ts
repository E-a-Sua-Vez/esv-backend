import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { EmailInputDto } from '../model/email-input.dto';
import { NotificationClient } from './notification-client';

@Injectable()
export class WhatsGwClient implements NotificationClient {
  private readonly whatsGwUrl = process.env.WHATSGW_API_URL;
  private readonly whatsGwApiKey = process.env.WHATSGW_API_KEY;
  private readonly whatsGwPhoneNumber = process.env.WHATSGW_PHONE_NUMBER;

  constructor(
    private readonly httpService: HttpService
  ) {}

  public async sendMessage(message: string, phone: string, notificationId: string): Promise<any> {
    const url = `${this.whatsGwUrl}`;
    const body = {
      apikey: this.whatsGwApiKey,
      phone_number: this.whatsGwPhoneNumber,
      contact_phone_number: phone,
      message_custom_id: notificationId,
      message_type: 'text',
      message_body: message,
      check_status : 1
    };
    return (await firstValueFrom(this.httpService.post(url, body))).data;
  }

  sendEmail(email: EmailInputDto): Promise<any> {
    throw new Error('Method not implemented.');
  }
}
