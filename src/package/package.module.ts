import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { AttentionModule } from '../attention/attention.module';
import { BookingModule } from '../booking/booking.module';
import { IncomeModule } from '../income/income.module';

import { Package } from './model/package.entity';
import { PackageController } from './package.controller';
import { PackageService } from './package.service';

@Module({
  imports: [
    FireormModule.forFeature([Package]),
    forwardRef(() => IncomeModule),
    forwardRef(() => AttentionModule),
    forwardRef(() => BookingModule),
  ],
  providers: [PackageService],
  exports: [PackageService],
  controllers: [PackageController],
})
export class PackageModule {}
