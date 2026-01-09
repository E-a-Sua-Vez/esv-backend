import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray, IsOptional, IsEnum } from 'class-validator';
import { MessagePriority } from '../model/message-priority.enum';
import { MessageCategory } from '../model/message-category.enum';

export class SendMassMessageDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ enum: MessageCategory, required: false, default: MessageCategory.ANNOUNCEMENT })
  @IsOptional()
  @IsEnum(MessageCategory)
  category?: MessageCategory;

  @ApiProperty({ enum: MessagePriority, required: false, default: MessagePriority.NORMAL })
  @IsOptional()
  @IsEnum(MessagePriority)
  priority?: MessagePriority;

  @ApiProperty({ description: 'Target user types', isArray: true })
  @IsArray()
  @IsString({ each: true })
  targetUserTypes: string[]; // ['administrator', 'collaborator', 'business']

  @ApiProperty({ description: 'Target business IDs (empty = all businesses)', isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetBusinessIds?: string[];

  @ApiProperty({ description: 'Target commerce IDs (empty = all commerces)', isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetCommerceIds?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  actionLink?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  actionLabel?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  expiresAt?: Date;
}