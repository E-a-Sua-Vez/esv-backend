import { IsString, IsNotEmpty } from 'class-validator';

export class ReopenPeriodDto {
  @IsString()
  @IsNotEmpty()
  reopenedBy: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
