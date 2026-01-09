import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { MessageCategory } from '../model/message-category.enum';
import { MessagePriority } from '../model/message-priority.enum';

export class SendMessageDto {
  @IsEnum(MessageCategory)
  @IsNotEmpty()
  category: MessageCategory;

  @IsEnum(MessagePriority)
  @IsOptional()
  priority?: MessagePriority;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  actionLink?: string;

  @IsString()
  @IsOptional()
  actionLabel?: string;

  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @IsString()
  @IsNotEmpty()
  recipientType: 'master' | 'business' | 'collaborator' | 'client';

  @IsString()
  @IsOptional()
  commerceId?: string;

  @IsString()
  @IsOptional()
  conversationId?: string;

  @IsOptional()
  expiresAt?: Date;
}

export class BulkReadDto {
  @IsArray()
  @IsOptional()
  messageIds?: string[];

  @IsOptional()
  filters?: {
    category?: MessageCategory;
    olderThan?: Date;
  };
}

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  participantId: string;

  @IsString()
  @IsNotEmpty()
  commerceId: string;
}
