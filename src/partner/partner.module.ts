import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { PartnerController } from './partner.controller';
import { Partner } from './partner.entity';
import { PartnerService } from './partner.service';

@Module({
  imports: [FireormModule.forFeature([Partner])],
  providers: [PartnerService],
  exports: [PartnerService],
  controllers: [PartnerController],
})
export class PartnerModule {}
