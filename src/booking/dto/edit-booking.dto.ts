import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsObject, IsOptional, IsDateString } from 'class-validator';

import { BlockDto } from './create-booking.dto';

export class EditBookingDto {
  @ApiProperty({
    description: 'New booking date (YYYY-MM-DD)',
    example: '2024-01-20',
  })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({
    description: 'New time block information',
    type: BlockDto,
  })
  @IsObject()
  @IsOptional()
  block?: BlockDto;
}
