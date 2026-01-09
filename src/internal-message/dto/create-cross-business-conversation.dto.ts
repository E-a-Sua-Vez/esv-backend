import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateCrossBusinessConversationDto {
  @ApiProperty({ description: 'Target user ID (admin or collaborator from any business)' })
  @IsNotEmpty()
  @IsString()
  recipientId: string;

  @ApiProperty({ description: 'Target user type' })
  @IsNotEmpty()
  @IsString()
  recipientType: string; // 'administrator' | 'collaborator' | 'business'

  @ApiProperty({ description: 'Target business ID', required: false })
  @IsOptional()
  @IsString()
  targetBusinessId?: string;

  @ApiProperty({ description: 'Target commerce ID', required: false })
  @IsOptional()
  @IsString()
  targetCommerceId?: string;

  @ApiProperty({ description: 'Initial message content', required: false })
  @IsOptional()
  @IsString()
  initialMessage?: string;
}