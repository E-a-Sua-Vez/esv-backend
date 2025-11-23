import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from 'src/user/model/user.entity';

import { Block } from '../model/booking.entity';

export class BookingAvailabilityDto {
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

  @ApiProperty({ description: 'Booking status' })
  status: string;

  @ApiPropertyOptional({ description: 'Time block information', type: Block })
  block?: Block;

  @ApiPropertyOptional({ description: 'User information', type: User })
  user?: User;
}
