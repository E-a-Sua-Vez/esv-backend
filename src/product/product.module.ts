import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { ProductController } from './product.controller';
import { Product } from './model/product.entity';
import { ProductService } from './product.service';

@Module({
  imports: [
    FireormModule.forFeature([Product]),
  ],
  providers: [ProductService],
  exports: [ProductService],
  controllers: [ProductController],
})
export class ProductModule {}