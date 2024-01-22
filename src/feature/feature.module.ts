import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { FeatureController } from './feature.controller';
import { Feature } from './feature.entity';
import { FeatureService } from './feature.service';

@Module({
  imports: [
    FireormModule.forFeature([Feature])
  ],
  providers: [FeatureService],
  exports: [FeatureService],
  controllers: [FeatureController],
})
export class FeatureModule {}