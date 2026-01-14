import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { CommerceModule } from 'src/commerce/commerce.module';
import { AdministratorModule } from 'src/administrator/administrator.module';
import { InternalMessageModule } from 'src/internal-message/internal-message.module';
import { WhatsGwClient } from 'src/notification/infrastructure/whatsgw-client';
import { WhatsappHealthCheckService } from 'src/shared/services/whatsapp-health-check.service';
import { PermissionModule } from '../permission/permission.module';

import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { Business } from './model/business.entity';

@Module({
  imports: [
    FireormModule.forFeature([Business]),
    forwardRef(() => CommerceModule),
    HttpModule,
    forwardRef(() => PermissionModule),
    forwardRef(() => InternalMessageModule),
    forwardRef(() => AdministratorModule),
  ],
  providers: [BusinessService, WhatsGwClient, WhatsappHealthCheckService],
  exports: [BusinessService],
  controllers: [BusinessController],
})
export class BusinessModule {}
