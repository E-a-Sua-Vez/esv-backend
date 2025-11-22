import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { CollaboratorModule } from '../collaborator/collaborator.module';
import { ServiceModule } from '../service/service.module';

import { Queue } from './model/queue.entity';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';

@Module({
  imports: [
    FireormModule.forFeature([Queue]),
    forwardRef(() => CollaboratorModule),
    forwardRef(() => ServiceModule),
  ],
  providers: [QueueService],
  exports: [QueueService],
  controllers: [QueueController],
})
export class QueueModule {}
