import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import { EmailInputDto, RawEmailInputDto } from '../model/email-input.dto';

import { NotificationClient } from './notification-client';

@Injectable()
export class WhatsGwClient implements NotificationClient {
  private readonly whatsGwUrl = process.env.WHATSGW_API_URL;
  private readonly whatsGwEventsUrl = process.env.WHATSGW_EVENTS_API_URL;
  private readonly whatsGwRequestUrl = process.env.WHATSGW_REQUEST_API_URL;
  private readonly whatsGwApiKey = process.env.WHATSGW_API_KEY;
  private readonly whatsGwPhoneNumber = process.env.WHATSGW_PHONE_NUMBER;

  constructor(private readonly httpService: HttpService) {}

  public async sendMessage(
    message: string,
    phone: string,
    notificationId: string,
    servicePhoneNumber?: string
  ): Promise<any> {
    const url = `${this.whatsGwUrl}/Send`;
    const fromNumber = servicePhoneNumber || this.whatsGwPhoneNumber;
    const body = {
      apikey: this.whatsGwApiKey,
      phone_number: fromNumber,
      contact_phone_number: phone,
      message_custom_id: notificationId,
      message_type: 'text',
      message_body: message,
      check_status: 1,
    };
    console.log(`[WhatsGwClient] Sending WhatsApp message:`, {
      from: fromNumber,
      to: phone,
      notificationId,
      messageLength: message.length,
      url,
    });
    const response = (await firstValueFrom(this.httpService.post(url, body))).data;
    console.log(`[WhatsGwClient] WhatsApp response:`, response);
    return response;
  }

  public async requestConnection(): Promise<any> {
    const url = `${this.whatsGwRequestUrl}/NewInstance`;
    const params = new URLSearchParams();
    params.append('apikey', this.whatsGwApiKey);
    params.append('type', '1');
    return (await firstValueFrom(this.httpService.post(url, params))).data;
  }

  public async requestEvent(): Promise<any> {
    const url = `${this.whatsGwEventsUrl}/GetEvents`;
    const body = {
      apikey: this.whatsGwApiKey,
    };
    const result = (await firstValueFrom(this.httpService.post(url, body))).data;
    const response = JSON.parse(JSON.stringify(result));
    return response;
  }

  public async requestServiceStatus(serviceId: string): Promise<any> {
    const url = `${this.whatsGwRequestUrl}/PhoneState`;
    const params = new URLSearchParams();
    params.append('apikey', this.whatsGwApiKey);
    params.append('phone_number', serviceId);
    try {
      return (await firstValueFrom(this.httpService.post(url, params))).data;
    } catch (error) {
      // If the service returns 404, it means the instance doesn't exist
      if (error.response && error.response.status === 404) {
        throw new Error('WhatsApp instance not found in gateway (404)');
      }
      // Re-throw the original error message
      throw new Error(error.response?.data?.message || error.message || 'Unknown error');
    }
  }

  public async disconnectService(serviceId: string): Promise<any> {
    const url = `${this.whatsGwRequestUrl}/RemoveInstance`;
    const params = new URLSearchParams();
    params.append('apikey', this.whatsGwApiKey);
    params.append('w_instancia_id', serviceId);
    return (await firstValueFrom(this.httpService.post(url, params))).data;
  }

  sendEmail(email: EmailInputDto): Promise<any> {
    throw new Error('Method not implemented.');
  }
  sendRawEmail(data: RawEmailInputDto): Promise<any> {
    throw new Error('Method not implemented.');
  }
}
