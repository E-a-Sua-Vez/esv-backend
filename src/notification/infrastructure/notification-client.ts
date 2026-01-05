import { EmailInputDto, RawEmailInputDto } from '../model/email-input.dto';
export interface NotificationClient {
  sendMessage(
    message: string,
    phone: string,
    notificationId?: string,
    serviceNumber?: string
  ): Promise<any>;
  sendSms?(message: string, phone: string, notificationId?: string): Promise<any>;
  sendEmail(data: EmailInputDto): Promise<any>;
  sendRawEmail(data: RawEmailInputDto): Promise<any>;
  requestConnection(): Promise<any>;
  requestEvent(): Promise<any>;
  requestServiceStatus(serviceId: string): Promise<any>;
  disconnectService(serviceId: string): Promise<any>;
}
