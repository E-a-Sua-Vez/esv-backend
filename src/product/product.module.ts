import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { InternalMessageModule } from '../internal-message/internal-message.module';

import { Product, ProductReplacement, ProductConsumption } from './model/product.entity';
import { ProductAlertService } from './product-alert.service';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [
    FireormModule.forFeature([Product, ProductReplacement, ProductConsumption]),
    forwardRef(() => InternalMessageModule),
  ],
  providers: [ProductService, ProductAlertService],
  exports: [ProductService, ProductAlertService],
  controllers: [ProductController],
})
export class ProductModule {}
