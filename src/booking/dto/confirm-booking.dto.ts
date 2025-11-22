import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class ConfirmBookingDto {
  @ApiPropertyOptional({
    description: 'Confirmation data',
    type: 'object',
    example: { confirmed: true, confirmedAt: '2024-01-15T10:00:00Z' },
    additionalProperties: true,
  })
  @IsObject()
  @IsOptional()
  confirmationData?: any;
}
