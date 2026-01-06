import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { BusinessLogoController } from './business-logo.controller';
import { BusinessLogoService } from './business-logo.service';
import { BusinessLogo } from './model/business-logo.entity';

@Module({
  imports: [FireormModule.forFeature([BusinessLogo])],
  controllers: [BusinessLogoController],
  providers: [BusinessLogoService],
  exports: [BusinessLogoService],
})
export class BusinessLogoModule {}












