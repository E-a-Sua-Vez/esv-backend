import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/user.decorator';
import {
  BulkReadDto,
  CreateConversationDto,
  SendMessageDto,
} from './dto/message.dto';
import { SendMassMessageDto } from './dto/send-mass-message.dto';
import { CreateCrossBusinessConversationDto } from './dto/create-cross-business-conversation.dto';
import { GetInboxDto } from './dto/get-inbox.dto';
import { SendSystemNotificationDto } from './dto/send-system-notification.dto';
import { InternalMessageService } from './internal-message.service';
import { InternalMessage } from './model/internal-message.entity';
import { MessageConversation } from './model/message-conversation.entity';

@ApiTags('internal-message')
@Controller('internal-message')
export class InternalMessageController {
  constructor(private readonly internalMessageService: InternalMessageService) {}

  @Post('system-notification')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send system notification' })
  @ApiResponse({ status: 201, description: 'Notification sent', type: InternalMessage })
  async sendSystemNotification(@Body() dto: SendSystemNotificationDto): Promise<InternalMessage> {
    return this.internalMessageService.sendSystemNotification(dto);
  }

  @Post('send')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send message (chat)' })
  @ApiResponse({ status: 201, description: 'Message sent', type: InternalMessage })
  async sendMessage(
    @User() user: any,
    @Body() dto: SendMessageDto,
  ): Promise<InternalMessage> {

    // Extraer userId del objeto user (puede ser string o objeto con id/userId)
    const userId = typeof user === 'string' ? user : (user.id || user.userId || user.uid);

    // Extraer userType del objeto user (puede venir como userType, type, o inferirlo de otras propiedades)
    let userType = user.userType || user.type;

    // Si no hay userType explícito, intentar inferirlo
    if (!userType) {
      if (user.businessId && !user.commerceId) {
        userType = 'business';
      } else if (user.commerceId) {
        userType = 'collaborator';
      } else if (user.role === 'admin' || user.role === 'administrator') {
        userType = 'administrator';
      } else {
        userType = 'collaborator'; // Fallback
      }
    }

    return this.internalMessageService.sendMessage(userId, userType, dto);
  }

  @Get('inbox')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user inbox' })
  @ApiResponse({ status: 200, description: 'Inbox retrieved' })
  async getInbox(@User() userId: string, @Query() filters: GetInboxDto): Promise<any> {
    return this.internalMessageService.getInbox(userId, filters);
  }

  @Patch(':id/read')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mark message as read' })
  @ApiResponse({ status: 200, description: 'Message marked as read', type: InternalMessage })
  async markAsRead(
    @User() userId: string,
    @Param('id') messageId: string,
  ): Promise<InternalMessage> {
    return this.internalMessageService.markAsRead(userId, messageId);
  }

  @Post('bulk/read')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark multiple messages as read' })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  async bulkMarkAsRead(@User() userId: string, @Body() dto: BulkReadDto): Promise<any> {
    return this.internalMessageService.bulkMarkAsRead(userId, dto);
  }

  @Post('bulk/archive')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive multiple messages' })
  @ApiResponse({ status: 200, description: 'Messages archived' })
  async bulkArchive(@User() userId: string, @Body() dto: BulkReadDto): Promise<any> {
    return this.internalMessageService.bulkArchive(userId, dto);
  }

  @Patch(':id/archive')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Archive message' })
  @ApiResponse({ status: 200, description: 'Message archived', type: InternalMessage })
  async archiveMessage(
    @User() userId: string,
    @Param('id') messageId: string,
  ): Promise<InternalMessage> {
    try {
      const result = await this.internalMessageService.archiveMessage(userId, messageId);
      return result;
    } catch (error) {
      console.error('[Archive] Error:', error.message);
      throw error;
    }
  }

  @Post('conversation')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get or create conversation' })
  @ApiResponse({ status: 200, description: 'Conversation retrieved or created' })
  async getOrCreateConversation(
    @User() userId: string,
    @Body() dto: CreateConversationDto,
  ): Promise<MessageConversation> {
    return this.internalMessageService.getOrCreateConversation(userId, dto);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get message by ID' })
  @ApiResponse({ status: 200, description: 'Message retrieved', type: InternalMessage })
  async getMessageById(@Param('id') messageId: string): Promise<InternalMessage> {
    return this.internalMessageService.getMessageById(messageId);
  }

  // ========== MASTER USER ENDPOINTS ==========

  @Post('mass/send')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send mass message (MASTER only)' })
  @ApiResponse({ status: 201, description: 'Mass messages sent' })
  async sendMassMessage(
    @User() user: any,
    @Body() dto: SendMassMessageDto,
  ): Promise<{ sent: number; failed: number; details: any[] }> {
    const userId = typeof user === 'string' ? user : (user.id || user.userId || user.uid);
    const userType = user.userType || user.type || 'master';

    return this.internalMessageService.sendMassMessage(userId, userType, dto);
  }

  @Post('conversation/cross-business')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create cross-business conversation (MASTER only)' })
  @ApiResponse({ status: 200, description: 'Cross-business conversation created' })
  async createCrossBusinessConversation(
    @User() user: any,
    @Body() dto: CreateCrossBusinessConversationDto,
  ): Promise<MessageConversation> {
    const userId = typeof user === 'string' ? user : (user.id || user.userId || user.uid);
    const userType = user.userType || user.type || 'master';

    return this.internalMessageService.createCrossBusinessConversation(userId, userType, dto);
  }
}
