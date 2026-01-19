import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { Professional } from './model/professional.entity';
import { ProfessionalController } from './professional.controller';
import { ProfessionalService } from './professional.service';

@Module({
  imports: [FireormModule.forFeature([Professional])],
  providers: [ProfessionalService],
  controllers: [ProfessionalController],
  exports: [ProfessionalService],
})
export class ProfessionalModule {}
