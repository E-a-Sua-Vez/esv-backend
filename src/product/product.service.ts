import { Product, ProductInfo } from './model/product.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import ProductCreated from './events/ProductCreated';
import ProductUpdated from './events/ProductUpdated';
import { ProductType } from './model/product-type.enum';
import { MeasureType } from './model/measure-type.enum';

@Injectable()
export class ProductService {
  constructor(
  @InjectRepository(Product)
    private productRepository = getRepository(Product)
  ) {}

  public async getProductById(id: string): Promise<Product> {
    let product = await this.productRepository.findById(id);
    return product;
  }

  public async getProducts(): Promise<Product[]> {
    let products: Product[] = [];
    products = await this.productRepository.find();
    return products;
  }

  public async getProductByCommerce(commerceId: string): Promise<Product[]> {
    let products: Product[] = [];
    products = await this.productRepository
      .whereEqualTo('commerceId', commerceId)
      .orderByAscending('order')
      .whereEqualTo('available', true)
      .find();
    return products;
  }

  public async getProductsById(productsId: string[]): Promise<Product[]> {
    let products: Product[] = [];
    products = await this.productRepository
      .whereIn('id', productsId)
      .whereEqualTo('available', true)
      .orderByAscending('order')
      .find();
    return products;
  }

  public async getActiveProductsByCommerce(commerceId: string): Promise<Product[]> {
    let products: Product[] = [];
    products = await this.productRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .orderByAscending('order')
      .find();
    return products;
  }

  public async getOnlineProductsByCommerce(commerceId: string): Promise<Product[]> {
    let products: Product[] = [];
    products = await this.productRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .whereEqualTo('online', true)
      .orderByAscending('order')
      .find();
    return products;
  }

  public async updateProductConfigurations(
    user: string,
    id: string,
    name: string,
    tag: string,
    order: number,
    active: boolean,
    available: boolean,
    online: boolean,
    code: string,
    measureType: MeasureType,
    actualLevel: number,
    minimumLevel: number,
    maximumLevel: number,
    optimumLevel: number,
    replacementLevel: number,
    productInfo: ProductInfo
  ): Promise<Product> {
    try {
      let product = await this.productRepository.findById(id);
      if (name) {
        product.name = name;
      }
      if (tag) {
        product.tag = tag;
      }
      if (order) {
        product.order = order;
      }
      if (active !== undefined) {
        product.active = active;
      }
      if (available !== undefined) {
        product.available = available;
      }
      if (online !== undefined) {
        product.online = online;
      }
      if (productInfo !== undefined) {
        product.productInfo = productInfo;
      }
      if (code !== undefined) {
        product.code = code;
      }
      if (measureType !== undefined) {
        product.measureType = measureType;
      }
      if (actualLevel !== undefined) {
        product.actualLevel = actualLevel;
      }
      if (minimumLevel !== undefined) {
        product.minimumLevel = minimumLevel;
      }
      if (maximumLevel !== undefined) {
        product.maximumLevel = maximumLevel;
      }
      if (optimumLevel !== undefined) {
        product.optimumLevel = optimumLevel;
      }
      if (replacementLevel !== undefined) {
        product.replacementLevel = replacementLevel;
      }
      return await this.updateProduct(user, product);
    } catch (error) {
      throw new HttpException(`Hubo un problema al modificar el producto: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async updateProduct(user: string, product: Product): Promise<Product> {
    const productUpdated = await await this.productRepository.update(product);
    const productUpdatedEvent = new ProductUpdated(new Date(), productUpdated, { user });
    publish(productUpdatedEvent);
    return productUpdated;
  }

  public async createProduct(
    user: string,
    commerceId: string,
    name: string,
    type: ProductType,
    tag: string,
    online: boolean,
    order: number,
    code: string,
    measureType: MeasureType,
    actualLevel: number,
    minimumLevel: number,
    maximumLevel: number,
    optimumLevel: number,
    replacementLevel: number,
    productInfo: ProductInfo
  ): Promise<Product> {
    let product = new Product();
    product.commerceId = commerceId;
    product.name = name;
    product.type = type || ProductType.SERVICE;
    product.tag = tag;
    product.online = online;
    product.active = true;
    product.available = true;
    product.createdAt = new Date();
    product.order = order;
    product.code = code;
    product.measureType = measureType;
    product.minimumLevel = minimumLevel;
    product.maximumLevel = maximumLevel;
    product.optimumLevel = optimumLevel;
    product.actualLevel = actualLevel;
    product.replacementLevel = replacementLevel;
    product.productInfo = productInfo;
    const productCreated = await this.productRepository.create(product);
    const productCreatedEvent = new ProductCreated(new Date(), productCreated, { user });
    publish(productCreatedEvent);
    return productCreated;
  }
}
