import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { MessageModule } from '../message/message.module';

import { Product, ProductReplacement, ProductConsumption } from './model/product.entity';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [
    FireormModule.forFeature([Product, ProductReplacement, ProductConsumption]),
    forwardRef(() => MessageModule),
  ],
  providers: [ProductService],
  exports: [ProductService],
  controllers: [ProductController],
})
export class ProductModule {}
