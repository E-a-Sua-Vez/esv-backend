import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

import { MessageCategory } from '../model/message-category.enum';
import { MessagePriority } from '../model/message-priority.enum';
import { MessageStatus } from '../model/message-status.enum';
import { MessageType } from '../model/message-type.enum';

export class GetInboxDto {
  @IsArray()
  @IsOptional()
  status?: MessageStatus[];

  @IsArray()
  @IsOptional()
  category?: MessageCategory[];

  @IsArray()
  @IsOptional()
  priority?: MessagePriority[];

  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType;

  @IsString()
  @IsOptional()
  commerceId?: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  offset?: number;

  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
