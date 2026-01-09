import { Injectable, Logger } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import * as MESSAGES from './messages/messages.js';
import { Product } from './model/product.entity';

export enum AlertLevel {
  PREVENTIVE = 'PREVENTIVE', // 30 días antes
  ATTENTION = 'ATTENTION', // 15 días antes
  CRITICAL = 'CRITICAL', // 7 días antes o stock bajo
  EXPIRATION = 'EXPIRATION', // 30 días antes de expiración
}

export interface ProductAlert {
  productId: string;
  productName: string;
  level: AlertLevel;
  message: string;
  daysUntilStockout?: number;
  daysUntilExpiration?: number;
  currentStock: number;
  replacementLevel: number;
  recommendedAction: string;
}

@Injectable()
export class ProductAlertService {
  private readonly logger = new Logger(ProductAlertService.name);

  constructor(
    @InjectRepository(Product)
    private productRepository = getRepository(Product)
  ) {}

  /**
   * Calcula días hasta agotarse basado en consumo histórico
   */
  private calculateDaysUntilStockout(product: Product): number | null {
    if (!product.actualLevel || product.actualLevel <= 0) {
      return 0; // Ya está agotado
    }

    if (product.productInfo?.lastComsumptionDate && product.productInfo?.lastComsumptionAmount) {
      const lastConsumptionDate = new Date(product.productInfo.lastComsumptionDate);
      const daysSinceLastConsumption = Math.floor(
        (new Date().getTime() - lastConsumptionDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastConsumption > 0 && product.productInfo.lastComsumptionAmount > 0) {
        const avgDailyConsumption =
          product.productInfo.lastComsumptionAmount / daysSinceLastConsumption;
        if (avgDailyConsumption > 0) {
          return Math.floor(product.actualLevel / avgDailyConsumption);
        }
      }
    }

    return null;
  }

  /**
   * Calcula días hasta expiración del lote más próximo
   */
  private async calculateDaysUntilExpiration(productId: string): Promise<number | null> {
    // Esta lógica debería obtener el lote más próximo a expirar
    // Por ahora retornamos null, se puede mejorar consultando replacements
    return null;
  }

  /**
   * Genera alertas para un producto específico
   */
  public async generateAlertsForProduct(user: string, product: Product): Promise<ProductAlert[]> {
    const alerts: ProductAlert[] = [];

    // Alerta de stock bajo (crítica)
    if (product.actualLevel <= product.replacementLevel) {
      alerts.push({
        productId: product.id,
        productName: product.name,
        level: AlertLevel.CRITICAL,
        message: `El producto ${product.name} está en nivel crítico (${product.actualLevel}/${product.replacementLevel})`,
        currentStock: product.actualLevel,
        replacementLevel: product.replacementLevel,
        recommendedAction: 'RECARGAR_INMEDIATAMENTE',
      });
    }

    // Calcular días hasta agotarse
    const daysUntilStockout = this.calculateDaysUntilStockout(product);

    if (daysUntilStockout !== null) {
      // Alerta preventiva (30 días antes)
      if (daysUntilStockout <= 30 && daysUntilStockout > 15) {
        alerts.push({
          productId: product.id,
          productName: product.name,
          level: AlertLevel.PREVENTIVE,
          message: `El producto ${product.name} se agotará en aproximadamente ${daysUntilStockout} días`,
          daysUntilStockout,
          currentStock: product.actualLevel,
          replacementLevel: product.replacementLevel,
          recommendedAction: 'PLANIFICAR_RECARGA',
        });
      }

      // Alerta de atención (15 días antes)
      if (daysUntilStockout <= 15 && daysUntilStockout > 7) {
        alerts.push({
          productId: product.id,
          productName: product.name,
          level: AlertLevel.ATTENTION,
          message: `El producto ${product.name} requiere atención - se agotará en aproximadamente ${daysUntilStockout} días`,
          daysUntilStockout,
          currentStock: product.actualLevel,
          replacementLevel: product.replacementLevel,
          recommendedAction: 'PROGRAMAR_RECARGA',
        });
      }

      // Alerta crítica (7 días antes)
      if (daysUntilStockout <= 7 && product.actualLevel > product.replacementLevel) {
        alerts.push({
          productId: product.id,
          productName: product.name,
          level: AlertLevel.CRITICAL,
          message: `El producto ${product.name} CRÍTICO - se agotará en aproximadamente ${daysUntilStockout} días`,
          daysUntilStockout,
          currentStock: product.actualLevel,
          replacementLevel: product.replacementLevel,
          recommendedAction: 'RECARGAR_URGENTE',
        });
      }
    }

    // Alerta de expiración
    if (product.productInfo?.lastReplacementExpirationDate) {
      const expirationDate = new Date(product.productInfo.lastReplacementExpirationDate);
      const daysUntilExpiration = Math.floor(
        (expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiration > 0 && daysUntilExpiration <= 30) {
        alerts.push({
          productId: product.id,
          productName: product.name,
          level: AlertLevel.EXPIRATION,
          message: `El producto ${product.name} expira en ${daysUntilExpiration} días`,
          daysUntilExpiration,
          currentStock: product.actualLevel,
          replacementLevel: product.replacementLevel,
          recommendedAction: 'USAR_PRIMERO',
        });
      }
    }

    return alerts;
  }

  /**
   * Procesa alertas para todos los productos de un comercio
   */
  public async processAlertsForCommerce(user: string, commerceId: string): Promise<ProductAlert[]> {
    try {
      const products = await this.productRepository
        .whereEqualTo('commerceId', commerceId)
        .whereEqualTo('available', true)
        .find();

      const allAlerts: ProductAlert[] = [];

      for (const product of products) {
        const alerts = await this.generateAlertsForProduct(user, product);
        allAlerts.push(...alerts);

        // Enviar notificaciones para alertas críticas
        const criticalAlerts = alerts.filter(a => a.level === AlertLevel.CRITICAL);
        for (const alert of criticalAlerts) {
          await this.sendAlertNotification(user, product, alert);
        }
      }

      return allAlerts;
    } catch (error) {
      this.logger.error(`Error processing alerts for commerce ${commerceId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Envía notificación de alerta
   */
  private async sendAlertNotification(
    user: string,
    product: Product,
    alert: ProductAlert
  ): Promise<void> {
    try {
      // Sistema antiguo eliminado - usar InternalMessageService si necesario
      this.logger.warn(
        `Alert for product ${product.name}: ${alert.level} - ${alert.message}`
      );
    } catch (error) {
      this.logger.error(`Error logging alert: ${error.message}`);
    }
  }

  /**
   * Obtiene alertas activas para un comercio
   */
  public async getActiveAlerts(commerceId: string): Promise<ProductAlert[]> {
    try {
      const products = await this.productRepository
        .whereEqualTo('commerceId', commerceId)
        .whereEqualTo('available', true)
        .find();

      const allAlerts: ProductAlert[] = [];

      for (const product of products) {
        const alerts = await this.generateAlertsForProduct('system', product);
        allAlerts.push(...alerts);
      }

      // Ordenar por prioridad: CRITICAL > EXPIRATION > ATTENTION > PREVENTIVE
      const priorityOrder = {
        [AlertLevel.CRITICAL]: 1,
        [AlertLevel.EXPIRATION]: 2,
        [AlertLevel.ATTENTION]: 3,
        [AlertLevel.PREVENTIVE]: 4,
      };

      return allAlerts.sort((a, b) => {
        return (priorityOrder[a.level] || 99) - (priorityOrder[b.level] || 99);
      });
    } catch (error) {
      this.logger.error(`Error getting active alerts: ${error.message}`);
      return [];
    }
  }
}
