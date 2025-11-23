import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { FeatureToggleController } from './feature-toggle.controller';
import { FeatureToggleService } from './feature-toggle.service';
import { FeatureToggle } from './model/feature-toggle.entity';

@Module({
  imports: [FireormModule.forFeature([FeatureToggle])],
  providers: [FeatureToggleService],
  exports: [FeatureToggleService],
  controllers: [FeatureToggleController],
})
export class FeatureToggleModule {}
