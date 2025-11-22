import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TransferBookingDto {
  @ApiProperty({
    description: 'Target queue ID',
    example: 'queue-456',
  })
  @IsString()
  queueId: string;
}
