import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { ProductController } from './product.controller';
import { Product, ProductReplacement, ProductConsumption } from './model/product.entity';
import { ProductService } from './product.service';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [
    FireormModule.forFeature([
      Product,
      ProductReplacement,
      ProductConsumption
    ]),
    forwardRef(() => MessageModule),
  ],
  providers: [ProductService],
  exports: [ProductService],
  controllers: [ProductController],
})
export class ProductModule {}