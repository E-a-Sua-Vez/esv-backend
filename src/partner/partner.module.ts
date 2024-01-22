import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { ModuleModule } from 'src/module/module.module';
import { PartnerController } from './partner.controller';
import { Partner } from './partner.entity';
import { PartnerService } from './partner.service';
import { CommerceModule } from 'src/commerce/commerce.module';

@Module({
  imports: [
    FireormModule.forFeature([Partner])
  ],
  providers: [ PartnerService],
  exports: [PartnerService],
  controllers: [PartnerController],
})
export class PartnerModule {}