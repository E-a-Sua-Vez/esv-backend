import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsArray, IsEnum, IsDateString } from 'class-validator';

import { BookingChannel } from '../model/booking-channel.enum';
import { BookingStatus } from '../model/booking-status.enum';

export class BlockDto {
  @ApiProperty({ description: 'Block number', example: 1 })
  number: number;

  @ApiProperty({ description: 'Start hour', example: '09:00' })
  hourFrom: string;

  @ApiProperty({ description: 'End hour', example: '10:00' })
  hourTo: string;

  @ApiPropertyOptional({ description: 'Nested blocks', type: [BlockDto] })
  blocks?: BlockDto[];

  @ApiPropertyOptional({ description: 'Block numbers', type: [Number] })
  blockNumbers?: number[];
}

export class UserDto {
  @ApiPropertyOptional({ description: 'User ID' })
  id?: string;

  @ApiProperty({ description: 'User name', example: 'John' })
  name: string;

  @ApiPropertyOptional({ description: 'User last name', example: 'Doe' })
  lastName?: string;

  @ApiPropertyOptional({ description: 'User email', example: 'john@example.com' })
  email?: string;

  @ApiPropertyOptional({ description: 'User phone', example: '+56912345678' })
  phone?: string;

  @ApiPropertyOptional({ description: 'User ID number' })
  idNumber?: string;

  @ApiProperty({ description: 'Accept terms and conditions', example: true })
  acceptTermsAndConditions: boolean;

  @ApiPropertyOptional({ description: 'Notification enabled', example: true })
  notificationOn?: boolean;

  @ApiPropertyOptional({ description: 'Email notification enabled', example: true })
  notificationEmailOn?: boolean;

  @ApiPropertyOptional({ description: 'Personal information', type: 'object' })
  personalInfo?: any;
}

export class CreateBookingDto {
  @ApiProperty({ description: 'Queue ID', example: 'queue-123' })
  @IsString()
  queueId: string;

  @ApiPropertyOptional({
    description: 'Booking channel',
    enum: BookingChannel,
    default: BookingChannel.QR,
  })
  @IsEnum(BookingChannel)
  @IsOptional()
  channel?: string;

  @ApiProperty({ description: 'Booking date (YYYY-MM-DD)', example: '2024-01-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: 'User information', type: UserDto })
  @IsObject()
  @IsOptional()
  user?: UserDto;

  @ApiPropertyOptional({ description: 'Time block information', type: BlockDto })
  @IsObject()
  @IsOptional()
  block?: BlockDto;

  @ApiPropertyOptional({
    description: 'Booking status',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @ApiPropertyOptional({ description: 'Service IDs', type: [String] })
  @IsArray()
  @IsOptional()
  servicesId?: string[];

  @ApiPropertyOptional({ description: 'Service details', type: 'array' })
  @IsArray()
  @IsOptional()
  servicesDetails?: object[];

  @ApiPropertyOptional({ description: 'Client ID' })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Session ID for block reservation' })
  @IsString()
  @IsOptional()
  sessionId?: string;
}
