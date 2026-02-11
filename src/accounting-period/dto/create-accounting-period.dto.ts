import { IsString, IsNotEmpty, IsDateString, IsOptional, MinLength } from 'class-validator';

export class CreateAccountingPeriodDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsNotEmpty()
  commerceId: string;

  @IsString()
  @IsNotEmpty()
  createdBy: string;
}
