import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { AdministratorModule } from '../administrator/administrator.module';
import { CommerceModule } from '../commerce/commerce.module';
import { FeatureToggleModule } from '../feature-toggle/feature-toggle.module';
import { InternalMessageModule } from '../internal-message/internal-message.module';
import { Product } from '../product/model/product.entity';
import { ProductModule } from '../product/product.module';

import { InventoryNotificationsController } from './inventory-notifications.controller';
import { InventoryNotificationsService } from './inventory-notifications.service';
import { SystemNotificationTracking } from './model/system-notification-tracking.entity';

@Module({
  imports: [
    FireormModule.forFeature([SystemNotificationTracking, Product]),
    AdministratorModule,
    CommerceModule,
    FeatureToggleModule,
    InternalMessageModule,
    ProductModule,
  ],
  controllers: [InventoryNotificationsController],
  providers: [InventoryNotificationsService],
  exports: [InventoryNotificationsService],
})
export class InventoryNotificationsModule {}
