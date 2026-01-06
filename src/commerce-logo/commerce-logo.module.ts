import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { CommerceLogoController } from './commerce-logo.controller';
import { CommerceLogoService } from './commerce-logo.service';
import { CommerceLogo } from './model/commerce-logo.entity';

@Module({
  imports: [FireormModule.forFeature([CommerceLogo])],
  controllers: [CommerceLogoController],
  providers: [CommerceLogoService],
  exports: [CommerceLogoService],
})
export class CommerceLogoModule {}
