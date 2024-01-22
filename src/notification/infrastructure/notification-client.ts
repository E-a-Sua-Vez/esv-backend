import { EmailInputDto } from '../model/email-input.dto';
export interface NotificationClient {
  sendMessage(message: string, phone: string, notificationId?: string, commerceId?: string, type?: string): Promise<any>;
  sendEmail(data: EmailInputDto): Promise<any>;
}
