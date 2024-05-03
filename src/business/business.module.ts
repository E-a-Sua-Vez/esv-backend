import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { BusinessController } from './business.controller';
import { Business } from './model/business.entity';
import { BusinessService } from './business.service';
import { CommerceModule } from 'src/commerce/commerce.module';
import { WhatsGwClient } from 'src/notification/infrastructure/whatsgw-client';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    FireormModule.forFeature([Business]),
    forwardRef(() => CommerceModule),
    HttpModule
  ],
  providers: [
    BusinessService,
    WhatsGwClient
  ],
  exports: [BusinessService],
  controllers: [BusinessController],
})
export class BusinessModule {}