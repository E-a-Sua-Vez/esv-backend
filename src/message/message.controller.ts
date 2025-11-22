import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

import { MessageService } from './message.service';
import { Message } from './model/message.entity';

@ApiTags('message')
@Controller('message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get message by ID',
    description: 'Retrieves a message by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Message ID', example: 'message-123' })
  @ApiResponse({ status: 200, description: 'Message found', type: Message })
  @ApiResponse({ status: 404, description: 'Message not found' })
  public async getMessageById(@Param() params: any): Promise<Message> {
    const { id } = params;
    return this.messageService.getMessageById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({ summary: 'Get all messages', description: 'Retrieves a list of all messages' })
  @ApiResponse({ status: 200, description: 'List of messages', type: [Message] })
  public async getMessages(): Promise<Message[]> {
    return this.messageService.getMessages();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/clientId/:clientId')
  @ApiOperation({
    summary: 'Get messages by client',
    description: 'Retrieves all messages for a specific client',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'clientId', description: 'Client ID', example: 'client-123' })
  @ApiResponse({ status: 200, description: 'List of messages', type: [Message] })
  public async getMessagesByClient(@Param() params: any): Promise<Message[]> {
    const { clientId } = params;
    return this.messageService.getMessagesByClient(clientId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/administratorId/:clientId')
  @ApiOperation({
    summary: 'Get messages by administrator',
    description: 'Retrieves all messages for a specific administrator',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({
    name: 'clientId',
    description: 'Administrator ID (note: param name is clientId but represents administratorId)',
    example: 'admin-123',
  })
  @ApiResponse({ status: 200, description: 'List of messages', type: [Message] })
  public async getMessagesByAdministrator(@Param() params: any): Promise<Message[]> {
    const { administratorId } = params;
    return this.messageService.getMessagesByAdministrator(administratorId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/collaboratorId/:collaboratorId')
  @ApiOperation({
    summary: 'Get messages by collaborator',
    description: 'Retrieves all messages for a specific collaborator',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'collaboratorId', description: 'Collaborator ID', example: 'collaborator-123' })
  @ApiResponse({ status: 200, description: 'List of messages', type: [Message] })
  public async getMessagesByCollaborator(@Param() params: any): Promise<Message[]> {
    const { collaboratorId } = params;
    return this.messageService.getMessagesByCollaborator(collaboratorId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new message',
    description: 'Creates a new notification message',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', example: 'NOTIFICATION' },
        commerceId: { type: 'string', example: 'commerce-123' },
        administratorId: { type: 'string' },
        collaboratorId: { type: 'string' },
        clientId: { type: 'string' },
        title: { type: 'string', example: 'New notification' },
        content: { type: 'string', example: 'Message content' },
        link: { type: 'string' },
        icon: { type: 'string' },
      },
      required: ['type', 'commerceId'],
    },
  })
  @ApiResponse({ status: 201, description: 'Message created successfully', type: Message })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createMessage(@User() user, @Body() body: any): Promise<Message> {
    const {
      type,
      commerceId,
      administratorId,
      collaboratorId,
      clientId,
      title,
      content,
      link,
      icon,
    } = body;
    return this.messageService.createMessage(
      user,
      type,
      commerceId,
      administratorId,
      collaboratorId,
      clientId,
      title,
      content,
      link,
      icon
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update message configurations',
    description: 'Updates message status (read, active, available)',
  })
  @ApiParam({ name: 'id', description: 'Message ID', example: 'message-123' })
  @ApiBody({ type: Message })
  @ApiResponse({ status: 200, description: 'Message updated successfully', type: Message })
  @ApiResponse({ status: 404, description: 'Message not found' })
  public async updateMessageConfigurations(
    @User() user,
    @Param() params: any,
    @Body() body: Message
  ): Promise<Message> {
    const { id } = params;
    const { active, available, read } = body;
    return this.messageService.updateMessageConfigurations(user, id, active, available, read);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/all/read')
  @ApiOperation({
    summary: 'Mark all messages as read',
    description: 'Marks all messages as read for a user (administrator, collaborator, or client)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        administratorId: { type: 'string' },
        collaboratorId: { type: 'string' },
        clientId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Messages marked as read', type: [Message] })
  public async markAllAsRead(@User() user, @Body() body: Message): Promise<Message[]> {
    const { administratorId, collaboratorId, clientId } = body;
    return this.messageService.markAllAsRead(user, administratorId, collaboratorId, clientId);
  }
}
