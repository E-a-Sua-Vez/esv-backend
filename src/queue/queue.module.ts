import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { QueueController } from './queue.controller';
import { Queue } from './queue.entity';
import { QueueService } from './queue.service';

@Module({
  imports: [FireormModule.forFeature([Queue])],
  providers: [QueueService],
  exports: [QueueService],
  controllers: [QueueController],
})
export class QueueModule {}