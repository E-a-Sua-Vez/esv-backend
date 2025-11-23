import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

import { Product, ProductConsumption, ProductReplacement } from './model/product.entity';
import { ProductService } from './product.service';

@ApiTags('product')
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get product by ID',
    description: 'Retrieves a product by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Product ID', example: 'product-123' })
  @ApiResponse({ status: 200, description: 'Product found', type: Product })
  @ApiResponse({ status: 404, description: 'Product not found' })
  public async getProductById(@Param() params: any): Promise<Product> {
    const { id } = params;
    return this.productService.getProductById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({ summary: 'Get all products', description: 'Retrieves a list of all products' })
  @ApiResponse({ status: 200, description: 'List of products', type: [Product] })
  public async getProducts(): Promise<Product[]> {
    return this.productService.getProducts();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId')
  @ApiOperation({
    summary: 'Get products by commerce',
    description: 'Retrieves all products for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of products', type: [Product] })
  public async getProductByCommerce(@Param() params: any): Promise<Product[]> {
    const { commerceId } = params;
    return this.productService.getProductByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/active')
  @ApiOperation({
    summary: 'Get active products by commerce',
    description: 'Retrieves all active products for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of active products', type: [Product] })
  public async getActiveProductsByCommerceId(@Param() params: any): Promise<Product[]> {
    const { commerceId } = params;
    return this.productService.getActiveProductsByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/list/:ids')
  @ApiOperation({
    summary: 'Get products by IDs',
    description: 'Retrieves multiple products by their IDs (comma-separated)',
  })
  @ApiParam({
    name: 'ids',
    description: 'Comma-separated product IDs',
    example: 'product-1,product-2,product-3',
  })
  @ApiResponse({ status: 200, description: 'List of products', type: [Product] })
  public async getProductsById(@Param() params: any): Promise<Product[]> {
    const { ids } = params;
    return this.productService.getProductsById(ids.split(','));
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new product',
    description: 'Creates a new product for inventory management',
  })
  @ApiBody({ type: Product })
  @ApiResponse({ status: 201, description: 'Product created successfully', type: Product })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createProduct(@User() user, @Body() body: Product): Promise<Product> {
    const {
      commerceId,
      name,
      type,
      tag,
      online,
      order,
      code,
      measureType,
      actualLevel,
      minimumLevel,
      maximumLevel,
      optimumLevel,
      replacementLevel,
      productInfo,
    } = body;
    return this.productService.createProduct(
      user,
      commerceId,
      name,
      type,
      tag,
      online,
      order,
      code,
      measureType,
      actualLevel,
      minimumLevel,
      maximumLevel,
      optimumLevel,
      replacementLevel,
      productInfo
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update product',
    description: 'Updates product configuration and inventory levels',
  })
  @ApiParam({ name: 'id', description: 'Product ID', example: 'product-123' })
  @ApiBody({ type: Product })
  @ApiResponse({ status: 200, description: 'Product updated successfully', type: Product })
  @ApiResponse({ status: 404, description: 'Product not found' })
  public async updateProduct(
    @User() user,
    @Param() params: any,
    @Body() body: Product
  ): Promise<Product> {
    const { id } = params;
    const {
      name,
      tag,
      order,
      active,
      available,
      online,
      code,
      measureType,
      actualLevel,
      minimumLevel,
      maximumLevel,
      optimumLevel,
      replacementLevel,
      productInfo,
    } = body;
    return this.productService.updateProductConfigurations(
      user,
      id,
      name,
      tag,
      order,
      active,
      available,
      online,
      code,
      measureType,
      actualLevel,
      minimumLevel,
      maximumLevel,
      optimumLevel,
      replacementLevel,
      productInfo
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/replacement')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create product replacement',
    description: 'Records a product replacement/restock',
  })
  @ApiBody({ type: ProductReplacement })
  @ApiResponse({
    status: 201,
    description: 'Product replacement created successfully',
    type: ProductReplacement,
  })
  public async createProductReplacement(
    @User() user,
    @Body() body: ProductReplacement
  ): Promise<ProductReplacement> {
    const {
      productId,
      replacedBy,
      price,
      currency,
      replacementAmount,
      replacementDate,
      replacementExpirationDate,
      nextReplacementDate,
      code,
    } = body;
    return this.productService.createProductReplacement(
      user,
      productId,
      replacedBy,
      price,
      currency,
      replacementAmount,
      replacementDate,
      replacementExpirationDate,
      nextReplacementDate,
      code
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/consumption')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create product consumption',
    description: 'Records product consumption/usage',
  })
  @ApiBody({ type: ProductConsumption })
  @ApiResponse({
    status: 201,
    description: 'Product consumption created successfully',
    type: ProductConsumption,
  })
  public async createProductConsumption(
    @User() user,
    @Body() body: ProductConsumption
  ): Promise<ProductConsumption> {
    const {
      productId,
      consumedBy,
      comsumptionAttentionId,
      consumptionAmount,
      consumptionDate,
      productReplacementId,
    } = body;
    return this.productService.createProductConsumption(
      user,
      productId,
      consumedBy,
      comsumptionAttentionId,
      consumptionAmount,
      consumptionDate,
      productReplacementId
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/replacement/available/:productId')
  @ApiOperation({
    summary: 'Get active replacements by product',
    description: 'Retrieves all active product replacements for a specific product',
  })
  @ApiParam({ name: 'productId', description: 'Product ID', example: 'product-123' })
  @ApiResponse({
    status: 200,
    description: 'List of active replacements',
    type: [ProductReplacement],
  })
  public async getActiveReplacementsByProduct(@Param() params: any): Promise<ProductReplacement[]> {
    const { productId } = params;
    return this.productService.getActiveReplacementsByProduct(productId);
  }
}
