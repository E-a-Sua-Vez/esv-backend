import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { MessageModule } from '../message/message.module';

import { Product, ProductReplacement, ProductConsumption } from './model/product.entity';
import { ProductAlertService } from './product-alert.service';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [
    FireormModule.forFeature([Product, ProductReplacement, ProductConsumption]),
    forwardRef(() => MessageModule),
  ],
  providers: [ProductService, ProductAlertService],
  exports: [ProductService, ProductAlertService],
  controllers: [ProductController],
})
export class ProductModule {}
