import { Number } from 'twilio/lib/twiml/VoiceResponse';
import { EmailInputDto } from '../model/email-input.dto';
export interface NotificationClient {
  sendMessage(message: string, phone: string, notificationId?: string, commerceId?: string, type?: string): Promise<any>;
  sendEmail(data: EmailInputDto): Promise<any>;
  requestConnection(): Promise<any>;
  requestEvent(): Promise<any>;
  requestServiceStatus(serviceId: string): Promise<any>;
  disconnectService(serviceId: string): Promise<any>;
}
