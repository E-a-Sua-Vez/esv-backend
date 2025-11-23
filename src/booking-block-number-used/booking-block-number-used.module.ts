import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { BookingBlockNumberUsedService } from './booking-block-number-used.service';
import { BookingBlockNumberUsed } from './model/booking-block-number-used';

@Module({
  imports: [FireormModule.forFeature([BookingBlockNumberUsed])],
  providers: [BookingBlockNumberUsedService],
  exports: [BookingBlockNumberUsedService],
  controllers: [],
})
export class BookingBlockNumberUsedModule {}
