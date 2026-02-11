import { IsString, IsNotEmpty } from 'class-validator';

export class LockPeriodDto {
  @IsString()
  @IsNotEmpty()
  lockedBy: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
