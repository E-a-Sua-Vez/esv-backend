import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { Product, ProductConsumption, ProductReplacement } from './model/product.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('product')
export class ProductController {
    constructor(private readonly productService: ProductService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getProductById(@Param() params: any): Promise<Product> {
        const { id } = params;
        return this.productService.getProductById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getProducts(): Promise<Product[]> {
        return this.productService.getProducts();
    }

    @UseGuards(AuthGuard)
    @Get('/commerce/:commerceId')
    public async getProductByCommerce(@Param() params: any): Promise<Product[]> {
        const { commerceId } = params;
        return this.productService.getProductByCommerce(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/active')
    public async getActiveProductsByCommerceId(@Param() params: any): Promise<Product[]> {
        const { commerceId } = params;
        return this.productService.getActiveProductsByCommerce(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/list/:ids')
    public async getProductsById(@Param() params: any): Promise<Product[]> {
        const { ids } = params;
        return this.productService.getProductsById(ids.split(','));
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createProduct(@User() user, @Body() body: Product): Promise<Product> {
        const { commerceId, name, type, tag, online, order, code, measureType, actualLevel,
            minimumLevel, maximumLevel, optimumLevel, replacementLevel, productInfo } = body;
        return this.productService.createProduct(user, commerceId, name, type, tag, online, order, code, measureType,
            actualLevel, minimumLevel, maximumLevel, optimumLevel, replacementLevel, productInfo);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateProduct(@User() user, @Param() params: any, @Body() body: Product): Promise<Product> {
        const { id } = params;
        const { name, tag, order, active, available, online, code, measureType, actualLevel,
            minimumLevel, maximumLevel, optimumLevel, replacementLevel, productInfo } = body;
        return this.productService.updateProductConfigurations(user, id, name, tag, order, active, available, online, code, measureType,
            actualLevel, minimumLevel, maximumLevel, optimumLevel, replacementLevel, productInfo);
    }

    @UseGuards(AuthGuard)
    @Post('/replacement')
    public async createProductReplacement(@User() user, @Body() body: ProductReplacement): Promise<ProductReplacement> {
        const { productId, replacedBy, price, currency, replacementAmount, replacementDate, replacementExpirationDate, nextReplacementDate, code } = body;
        return this.productService.createProductReplacement(user, productId, replacedBy, price, currency, replacementAmount, replacementDate, replacementExpirationDate, nextReplacementDate, code);
    }

    @UseGuards(AuthGuard)
    @Post('/consumption')
    public async createProductConsumption(@User() user, @Body() body: ProductConsumption): Promise<ProductConsumption> {
        const { productId, consumedBy, comsumptionAttentionId, consumptionAmount, consumptionDate } = body;
        return this.productService.createProductConsumption(user, productId, consumedBy, comsumptionAttentionId, consumptionAmount, consumptionDate);
    }
}