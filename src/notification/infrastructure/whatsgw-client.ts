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

    try {
      const response = (await firstValueFrom(this.httpService.post(url, body))).data;
      return response;
    } catch (error) {
      // Handle different types of errors
      if (error.response) {
        const { status, data } = error.response;
        let errorMessage = 'WhatsApp API error';

        switch (status) {
          case 404:
            // Phone not connected or instance not found
            errorMessage = `WhatsApp phone not connected [${data?.result_message || 'Phone not found'}] [${fromNumber}] [${phone}]`;
            break;
          case 401:
            errorMessage = 'WhatsApp API authentication failed - invalid API key';
            break;
          case 400:
            errorMessage = `WhatsApp API bad request: ${data?.result_message || 'Invalid parameters'}`;
            break;
          case 429:
            errorMessage = 'WhatsApp API rate limit exceeded';
            break;
          case 500:
          case 502:
          case 503:
            errorMessage = `WhatsApp API server error (${status}): ${data?.result_message || 'Service temporarily unavailable'}`;
            break;
          default:
            errorMessage = `WhatsApp API error (${status}): ${data?.result_message || error.response.statusText || 'Unknown error'}`;
        }

        // Create a structured error with the response data for better debugging
        const structuredError = new Error(errorMessage);
        (structuredError as any).whatsappError = {
          status,
          statusText: error.response.statusText,
          data,
          notificationId,
          fromNumber,
          toPhone: phone,
        };
        throw structuredError;
      } else if (error.request) {
        // Network or connection error
        const networkError = new Error(`WhatsApp API network error: Unable to connect to ${url}`);
        (networkError as any).whatsappError = {
          type: 'network',
          notificationId,
          fromNumber,
          toPhone: phone,
          originalError: error.message,
        };
        throw networkError;
      } else {
        // Configuration or other error
        const configError = new Error(`WhatsApp API configuration error: ${error.message}`);
        (configError as any).whatsappError = {
          type: 'configuration',
          notificationId,
          fromNumber,
          toPhone: phone,
          originalError: error.message,
        };
        throw configError;
      }
    }
  }

  public async requestConnection(): Promise<any> {
    const url = `${this.whatsGwRequestUrl}/NewInstance`;
    const params = new URLSearchParams();
    params.append('apikey', this.whatsGwApiKey);
    params.append('type', '1');

    try {
      return (await firstValueFrom(this.httpService.post(url, params))).data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error('WhatsApp connection service not available (404)');
      }

      // Re-throw with enhanced error message
      throw new Error(error.response?.data?.message || error.message || 'Unknown connection error');
    }
  }

  public async requestEvent(): Promise<any> {
    const url = `${this.whatsGwEventsUrl}/GetEvents`;
    const body = {
      apikey: this.whatsGwApiKey,
    };

    try {
      const result = (await firstValueFrom(this.httpService.post(url, body))).data;
      const response = JSON.parse(JSON.stringify(result));
      return response;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error('WhatsApp events service not available (404)');
      }

      // Re-throw with enhanced error message
      throw new Error(error.response?.data?.message || error.message || 'Unknown events error');
    }
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

    try {
      return (await firstValueFrom(this.httpService.post(url, params))).data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error(`WhatsApp service instance not found: ${serviceId}`);
      }

      // Re-throw with enhanced error message
      throw new Error(error.response?.data?.message || error.message || 'Unknown disconnect error');
    }
  }

  sendEmail(email: EmailInputDto): Promise<any> {
    throw new Error('Method not implemented.');
  }
  sendRawEmail(data: RawEmailInputDto): Promise<any> {
    throw new Error('Method not implemented.');
  }
}
