import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { OutcomeController } from './outcome.controller';
import { Outcome } from './model/outcome.entity';
import { OutcomeService } from './outcome.service';

@Module({
  imports: [
    FireormModule.forFeature([Outcome]),
  ],
  providers: [OutcomeService],
  exports: [OutcomeService],
  controllers: [OutcomeController],
})
export class OutcomeModule {}