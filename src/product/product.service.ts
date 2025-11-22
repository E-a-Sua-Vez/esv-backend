import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { MessageType } from 'src/message/model/type.enum';

import { MessageService } from '../message/message.service';

import ProductConsumed from './events/ProductConsumed';
import ProductCreated from './events/ProductCreated';
import ProductReplaced from './events/ProductReplaced';
import ProductUpdated from './events/ProductUpdated';
import * as MESSAGES from './messages/messages.js';
import { MeasureType } from './model/measure-type.enum';
import { ProductType } from './model/product-type.enum';
import {
  Product,
  ProductConsumption,
  ProductInfo,
  ProductReplacement,
} from './model/product.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository = getRepository(Product),
    @InjectRepository(ProductReplacement)
    private productReplacementRepository = getRepository(ProductReplacement),
    @InjectRepository(ProductConsumption)
    private productConsumptionRepository = getRepository(ProductConsumption),
    private messageService: MessageService
  ) {}

  public async getProductById(id: string): Promise<Product> {
    const product = await this.productRepository.findById(id);
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
      const product = await this.productRepository.findById(id);
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
      throw new HttpException(
        `Hubo un problema al modificar el producto: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async updateProduct(user: string, product: Product): Promise<Product> {
    const productUpdated = await this.productRepository.update(product);
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
    const product = new Product();
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

  public async createProductReplacement(
    user: string,
    productId: string,
    replacedBy: string,
    price: number,
    currency: string,
    replacementAmount: number,
    replacementDate: Date,
    replacementExpirationDate: Date,
    nextReplacementDate: Date,
    code: string
  ): Promise<ProductReplacement> {
    try {
      const product = await this.productRepository.findById(productId);
      if (product && product.id) {
        const productReplacement = new ProductReplacement();
        productReplacement.productId = productId;
        productReplacement.commerceId = product.commerceId;
        productReplacement.price = price;
        productReplacement.code = code;
        productReplacement.currency = currency;
        productReplacement.replacedBy = replacedBy;
        productReplacement.replacementAmount = replacementAmount;
        productReplacement.replacementActualLevel = replacementAmount;
        productReplacement.replacementDate = replacementDate;
        productReplacement.replacementExpirationDate = replacementExpirationDate;
        const [year, month, day] = new Date(replacementExpirationDate)
          .toISOString()
          .slice(0, 10)
          .split('-');
        productReplacement.replacementExpirationDateFormatted = new Date(+year, +month - 1, +day);
        productReplacement.nextReplacementDate = nextReplacementDate;
        productReplacement.active = true;
        productReplacement.available = true;
        productReplacement.createdAt = new Date();
        const productReplacementCreated = await this.productReplacementRepository.create(
          productReplacement
        );
        const productReplacedEvent = new ProductReplaced(new Date(), productReplacementCreated, {
          user,
        });
        publish(productReplacedEvent);
        product.actualLevel = product.actualLevel + replacementAmount;
        if (product.productInfo) {
          product.productInfo.lastReplacementAmount = replacementAmount;
          product.productInfo.lastReplacementBy = replacedBy;
          product.productInfo.lastReplacementId = productReplacement.id;
          product.productInfo.lastReplacementDate = replacementDate;
          product.productInfo.lastReplacementExpirationDate = replacementExpirationDate;
          product.productInfo.nextReplacementDate = nextReplacementDate;
        }
        await this.updateProduct(user, product);
        return productReplacementCreated;
      }
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al reponer el producto: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async sendMessage(user: string, product: Product, type: MessageType) {
    if (product.actualLevel <= product.replacementLevel) {
      const message = MESSAGES.getMessage(type, undefined, product.name);
      await this.messageService.sendMessageToAdministrator(
        user,
        product.commerceId,
        MessageType.STOCK_PRODUCT_RECHARGE,
        message
      );
    }
  }

  public async createProductConsumption(
    user: string,
    productId: string,
    consumedBy: string,
    comsumptionAttentionId: string,
    consumptionAmount: number,
    consumptionDate: Date,
    productReplacementId: string
  ): Promise<ProductConsumption> {
    try {
      const product = await this.productRepository.findById(productId);
      if (product && product.id) {
        if (
          consumptionAmount &&
          consumptionAmount > 0 &&
          consumptionAmount <= product.actualLevel
        ) {
          const productConsumption = new ProductConsumption();
          productConsumption.productId = productId;
          productConsumption.commerceId = product.commerceId;
          productConsumption.consumptionAmount = consumptionAmount;
          productConsumption.comsumptionAttentionId = comsumptionAttentionId;
          productConsumption.consumedBy = consumedBy;
          productConsumption.consumptionDate = consumptionDate;
          productConsumption.productReplacementId = productReplacementId;
          productConsumption.createdAt = new Date();
          const productConsumptionCreated = await this.productConsumptionRepository.create(
            productConsumption
          );
          const productConsumedEvent = new ProductConsumed(new Date(), productConsumptionCreated, {
            user,
          });
          publish(productConsumedEvent);
          await this.updateProductReplacement(user, productReplacementId, consumptionAmount);
          if (product.productInfo) {
            product.productInfo.lastComsumptionId = productConsumption.id;
            product.productInfo.lastComsumptionBy = consumedBy;
            product.productInfo.lastComsumptionAmount = consumptionAmount;
            product.productInfo.lastComsumptionDate = consumptionDate;
          }
          const replacements = await this.getActiveReplacementsByProduct(productId);
          const actualLevel = replacements.reduce(
            (acc, value) => acc + value.replacementActualLevel,
            0
          );
          product.actualLevel = actualLevel;
          await this.updateProduct(user, product);
          this.sendMessage(user, product, MessageType.STOCK_PRODUCT_RECHARGE);
          return productConsumptionCreated;
        } else {
          throw new HttpException(
            `Hubo un problema al consumir el producto: No hay suficiente producto`,
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        }
      } else {
        throw new HttpException(
          `Hubo un problema al consumir el producto: No existe el producto`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al consumir el producto: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async getActiveReplacementsByProduct(productId: string): Promise<ProductReplacement[]> {
    let products: ProductReplacement[] = [];
    products = await this.productReplacementRepository
      .whereEqualTo('productId', productId)
      .whereGreaterThan('replacementActualLevel', 0)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .orderByAscending('replacementExpirationDateFormatted')
      .find();
    return products;
  }

  public async getConsumptionsByProductReplacement(
    productReplacementId: string
  ): Promise<ProductConsumption[]> {
    let products: ProductConsumption[] = [];
    products = await this.productConsumptionRepository
      .whereEqualTo('productReplacementId', productReplacementId)
      .find();
    return products;
  }

  public async updateProducReplacement(
    user: string,
    product: ProductReplacement
  ): Promise<ProductReplacement> {
    const productUpdated = await this.productReplacementRepository.update(product);
    const productUpdatedEvent = new ProductReplaced(new Date(), productUpdated, { user });
    publish(productUpdatedEvent);
    return productUpdated;
  }

  public async updateProductReplacement(
    user: string,
    id: string,
    amount: number
  ): Promise<ProductReplacement> {
    try {
      const productReplacement = await this.productReplacementRepository.findById(id);
      if (productReplacement && productReplacement.id) {
        const consumptions = await this.getConsumptionsByProductReplacement(id);
        const consumed = consumptions.reduce((acc, value) => acc + value.consumptionAmount, 0);
        const available = productReplacement.replacementAmount - consumed;
        if (amount && amount > 0 && available >= 0) {
          productReplacement.replacementActualLevel = available;
          return await this.updateProducReplacement(user, productReplacement);
        }
      }
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al modificar el producto: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
