import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Notification } from './model/notification.entity';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('notification')
export class NotificationController {
    constructor(
        private readonly notificationService: NotificationService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getNotificationById(@Param() params: any): Promise<Notification> {
        const { id } = params;
        return this.notificationService.getNotificationById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getNotifications(): Promise<Notification[]> {
        return this.notificationService.getNotifications();
    }

    @Post('/third-party/:provider')
    public async notificationWebhook(@Param() params: any, @Body() body: any): Promise<any> {
        const { provider } = params;
        return this.notificationService.createNotificationReceived(provider, body);
    }
}