import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { PlanController } from './plan.controller';
import { Plan } from './model/plan.entity';
import { PlanService } from './plan.service';

@Module({
  imports: [
    FireormModule.forFeature([Plan])
  ],
  providers: [PlanService],
  exports: [PlanService],
  controllers: [PlanController],
})
export class PlanModule {}