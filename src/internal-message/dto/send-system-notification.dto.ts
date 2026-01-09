import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { MessageCategory } from '../model/message-category.enum';
import { MessagePriority } from '../model/message-priority.enum';

export class SendSystemNotificationDto {
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

  // Contexto de negocio opcional
  @IsString()
  @IsOptional()
  attentionId?: string;

  @IsString()
  @IsOptional()
  bookingId?: string;

  @IsString()
  @IsOptional()
  queueId?: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  documentId?: string;

  @IsString()
  @IsOptional()
  taskId?: string;

  @IsOptional()
  expiresAt?: Date;
}
