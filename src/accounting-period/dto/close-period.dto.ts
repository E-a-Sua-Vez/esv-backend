import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class ReconciliationDataDto {
  @IsOptional()
  bankBalance?: number;

  @IsOptional()
  systemBalance?: number;

  @IsOptional()
  difference?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ClosePeriodDto {
  @IsString()
  @IsNotEmpty()
  closedBy: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsObject()
  @IsOptional()
  reconciliationData?: ReconciliationDataDto;
}
