import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Commerce } from '../../commerce/model/commerce.entity';
import { Queue } from '../../queue/model/queue.entity';
import { User } from '../../user/model/user.entity';
import { Block } from '../model/booking.entity';

export class BookingDetailsDto {
  @ApiProperty({ description: 'Booking ID' })
  id: string;

  @ApiProperty({ description: 'Commerce ID' })
  commerceId: string;

  @ApiProperty({ description: 'Queue ID' })
  queueId: string;

  @ApiProperty({ description: 'Booking number', example: 1 })
  number: number;

  @ApiProperty({ description: 'Booking date', example: '2024-01-15' })
  date: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Booking type' })
  type: string;

  @ApiProperty({ description: 'Booking channel' })
  channel: string;

  @ApiProperty({ description: 'Booking status' })
  status: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiPropertyOptional({ description: 'Comment' })
  comment?: string;

  @ApiPropertyOptional({ description: 'Processing date' })
  processedAt?: Date;

  @ApiProperty({ description: 'Is processed', example: false })
  processed: boolean;

  @ApiPropertyOptional({ description: 'Cancellation date' })
  cancelledAt?: Date;

  @ApiProperty({ description: 'Is cancelled', example: false })
  cancelled: boolean;

  @ApiPropertyOptional({ description: 'Attention ID' })
  attentionId?: string;

  @ApiProperty({ description: 'Number of bookings before this one', example: 5 })
  beforeYou: number;

  @ApiProperty({ description: 'User information', type: User })
  user: User;

  @ApiProperty({ description: 'Commerce information', type: Commerce })
  commerce: Commerce;

  @ApiProperty({ description: 'Queue information', type: Queue })
  queue: Queue;

  @ApiPropertyOptional({ description: 'Time block information', type: Block })
  block?: Block;
}
