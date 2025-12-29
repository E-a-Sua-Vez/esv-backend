import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

import { Notification } from './model/notification.entity';
import { NotificationService } from './notification.service';

@ApiTags('notification')
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({
    summary: 'Get all notifications',
    description: 'Retrieves a list of all notifications',
  })
  @ApiResponse({ status: 200, description: 'List of notifications', type: [Notification] })
  public async getNotifications(): Promise<Notification[]> {
    return this.notificationService.getNotifications();
  }

  @Post('/third-party/:provider')
  @ApiOperation({
    summary: 'Third-party notification webhook',
    description: 'Receives webhook notifications from third-party providers',
  })
  @ApiParam({ name: 'provider', description: 'Notification provider', example: 'twilio' })
  @ApiBody({ description: 'Webhook payload from provider', type: 'object' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook data' })
  public async notificationWebhook(@Param() params: any, @Body() body: any): Promise<any> {
    const { provider } = params;
    return this.notificationService.createNotificationReceived(provider, body);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/whatsapp/preprontuario')
  @ApiOperation({
    summary: 'Send preprontuario WhatsApp reminder',
    description: 'Sends a WhatsApp message to remind client to complete preprontuario',
  })
  @ApiBody({
    description: 'Preprontuario reminder data',
    schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Client ID' },
        commerceId: { type: 'string', description: 'Commerce ID' },
        email: { type: 'string', description: 'Client email for attention' },
        phone: { type: 'string', description: 'Client phone number' },
        attentionLink: { type: 'string', description: 'Optional: Direct link to attention form. If not provided, will be generated from attentionId' },
        attentionId: { type: 'string', description: 'Optional: Attention ID. Required if attentionLink is not provided' },
        queueId: { type: 'string', description: 'Optional: Queue ID' },
      },
      required: ['clientId', 'commerceId', 'email', 'phone'],
    },
  })
  @ApiResponse({ status: 200, description: 'WhatsApp message sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  public async sendPreprontuarioWhatsapp(@Body() body: any): Promise<any> {
    const { clientId, commerceId, email, phone, attentionLink, attentionId, queueId } = body;
    return this.notificationService.sendPreprontuarioWhatsappReminder(
      clientId,
      commerceId,
      email,
      phone,
      attentionLink,
      attentionId,
      queueId,
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/whatsapp/agreement')
  @ApiOperation({
    summary: 'Send agreement WhatsApp reminder',
    description: 'Sends a WhatsApp message to remind client to complete agreement',
  })
  @ApiBody({
    description: 'Agreement reminder data',
    schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Client ID' },
        commerceId: { type: 'string', description: 'Commerce ID' },
        email: { type: 'string', description: 'Client email for agreement' },
        phone: { type: 'string', description: 'Client phone number' },
      },
      required: ['clientId', 'commerceId', 'email', 'phone'],
    },
  })
  @ApiResponse({ status: 200, description: 'WhatsApp message sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  public async sendAgreementWhatsapp(@Body() body: any): Promise<any> {
    const { clientId, commerceId, email, phone } = body;
    return this.notificationService.sendAgreementWhatsappReminder(
      clientId,
      commerceId,
      email,
      phone,
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get notification by ID',
    description: 'Retrieves a notification by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Notification ID', example: 'notification-123' })
  @ApiResponse({ status: 200, description: 'Notification found', type: Notification })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  public async getNotificationById(@Param() params: any): Promise<Notification> {
    const { id } = params;
    return this.notificationService.getNotificationById(id);
  }
}
