import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { CommerceModule } from 'src/commerce/commerce.module';
import { WhatsGwClient } from 'src/notification/infrastructure/whatsgw-client';

import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { Business } from './model/business.entity';

@Module({
  imports: [FireormModule.forFeature([Business]), forwardRef(() => CommerceModule), HttpModule],
  providers: [BusinessService, WhatsGwClient],
  exports: [BusinessService],
  controllers: [BusinessController],
})
export class BusinessModule {}
