import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ReceiveHL7MessageDto {
  @ApiProperty({
    description: 'HL7 message in raw format',
    example:
      'MSH|^~\\&|LAB|HOSPITAL|ESV|CLINIC|20240101120000||ORU^R01|12345|P|2.5\rOBR|1||12345^LAB|...',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Laboratory ID sending the message',
  })
  @IsString()
  @IsOptional()
  laboratoryId?: string;

  @ApiPropertyOptional({
    description: 'Laboratory name',
  })
  @IsString()
  @IsOptional()
  laboratoryName?: string;
}

export class HL7MessageResponseDto {
  @ApiProperty({
    description: 'Success status',
  })
  success: boolean;

  @ApiProperty({
    description: 'Message ID',
  })
  messageId: string;

  @ApiPropertyOptional({
    description: 'Processed exam order IDs',
  })
  examOrderIds?: string[];

  @ApiPropertyOptional({
    description: 'Error message if any',
  })
  error?: string;
}
