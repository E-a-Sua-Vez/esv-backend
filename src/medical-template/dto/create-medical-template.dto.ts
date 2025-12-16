import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsBoolean,
  IsObject,
  ValidateNested,
} from 'class-validator';

import { TemplateType, TemplateScope, TemplateVariable } from '../model/medical-template.entity';

export class TemplateVariableDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty({ enum: ['text', 'date', 'number', 'select'] })
  @IsEnum(['text', 'date', 'number', 'select'])
  type: 'text' | 'date' | 'number' | 'select';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  options?: string[];

  @ApiProperty({ default: false })
  @IsBoolean()
  required: boolean;
}

export class CreateMedicalTemplateDto {
  @ApiProperty()
  @IsString()
  commerceId: string;

  @ApiProperty()
  @IsString()
  doctorId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doctorName?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TemplateType })
  @IsEnum(TemplateType)
  type: TemplateType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiProperty({ type: [TemplateVariableDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateVariableDto)
  variables: TemplateVariableDto[];

  @ApiProperty({ enum: TemplateScope, default: TemplateScope.PERSONAL })
  @IsEnum(TemplateScope)
  scope: TemplateScope;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}
