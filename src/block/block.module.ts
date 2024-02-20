import { forwardRef, Module } from '@nestjs/common';
import { CommerceModule } from 'src/commerce/commerce.module';
import { QueueModule } from '../queue/queue.module';
import { BlockController } from './block.controller';
import { BlockService } from './block.service';

@Module({
  imports: [
    forwardRef(() => QueueModule),
    forwardRef(() => CommerceModule),
  ],
  providers: [BlockService],
  exports: [BlockService],
  controllers: [BlockController],
})
export class BlockModule {}