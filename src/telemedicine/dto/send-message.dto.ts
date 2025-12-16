import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  MaxLength,
  MinLength,
} from 'class-validator';

export class MessageAttachmentDto {
  @ApiProperty({ description: 'Tipo de archivo', enum: ['image', 'document', 'video'] })
  type: 'image' | 'document' | 'video';

  @ApiProperty({ description: 'URL del archivo' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ description: 'Nombre del archivo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Tamaño en bytes' })
  size?: number;
}

export class SendMessageDto {
  @ApiProperty({ description: 'ID de la sesión' })
  @IsNotEmpty()
  @IsString()
  sessionId: string;

  @ApiProperty({ description: 'Mensaje', maxLength: 10000 })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(10000) // Limit message length to prevent abuse
  message: string;

  @ApiPropertyOptional({ description: 'Archivos adjuntos', type: [MessageAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}
