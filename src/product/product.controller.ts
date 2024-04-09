import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { Product } from './model/product.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('product')
export class ProductController {
    constructor(private readonly productProduct: ProductService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getProductById(@Param() params: any): Promise<Product> {
        const { id } = params;
        return this.productProduct.getProductById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getProducts(): Promise<Product[]> {
        return this.productProduct.getProducts();
    }

    @UseGuards(AuthGuard)
    @Get('/commerce/:commerceId')
    public async getProductByCommerce(@Param() params: any): Promise<Product[]> {
        const { commerceId } = params;
        return this.productProduct.getProductByCommerce(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/active')
    public async getActiveProductsByCommerceId(@Param() params: any): Promise<Product[]> {
        const { commerceId } = params;
        return this.productProduct.getActiveProductsByCommerce(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/list/:ids')
    public async getProductsById(@Param() params: any): Promise<Product[]> {
        const { ids } = params;
        return this.productProduct.getProductsById(ids.split(','));
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createProduct(@User() user, @Body() body: Product): Promise<Product> {
        const { commerceId, name, type, tag, online, order, code, measureType, actualLevel,
            minimumLevel, maximumLevel, optimumLevel, replacementLevel, productInfo } = body;
        return this.productProduct.createProduct(user, commerceId, name, type, tag, online, order, code, measureType,
            actualLevel, minimumLevel, maximumLevel, optimumLevel, replacementLevel, productInfo);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateProduct(@User() user, @Param() params: any, @Body() body: Product): Promise<Product> {
        const { id } = params;
        const { name, tag, order, active, available, online, code, measureType, actualLevel,
            minimumLevel, maximumLevel, optimumLevel, replacementLevel, productInfo } = body;
        return this.productProduct.updateProductConfigurations(user, id, name, tag, order, active, available, online, code, measureType,
            actualLevel, minimumLevel, maximumLevel, optimumLevel, replacementLevel, productInfo);
    }
}