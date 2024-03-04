import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { QueueController } from './queue.controller';
import { Queue } from './model/queue.entity';
import { QueueService } from './queue.service';
import { CollaboratorModule } from '../collaborator/collaborator.module';
import { ServiceModule } from '../service/service.module';

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