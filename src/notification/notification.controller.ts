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
}
