import { Injectable, Logger } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { AdministratorService } from '../administrator/administrator.service';
import { CommerceService } from '../commerce/commerce.service';
import { FeatureToggleService } from '../feature-toggle/feature-toggle.service';
import { InternalMessageService } from '../internal-message/internal-message.service';
import { MessageCategory } from '../internal-message/model/message-category.enum';
import { MessagePriority } from '../internal-message/model/message-priority.enum';
import { Product, ProductReplacement } from '../product/model/product.entity';
import { ProductService } from '../product/product.service';

import { SystemNotificationTracking } from './model/system-notification-tracking.entity';

@Injectable()
export class InventoryNotificationsService {
  private readonly logger = new Logger(InventoryNotificationsService.name);

  constructor(
    @InjectRepository(SystemNotificationTracking)
    private trackingRepository = getRepository(SystemNotificationTracking),
    @InjectRepository(Product)
    private productRepository = getRepository(Product),
    private administratorService: AdministratorService,
    private commerceService: CommerceService,
    private featureToggleService: FeatureToggleService,
    private internalMessageService: InternalMessageService,
    private productService: ProductService
  ) {}

  /**
   * Endpoint HTTP para chequear productos con stock bajo
   * Llamado por GCP Scheduler
   */
  async checkLowStockProducts(): Promise<{ processed: number; notificationsSent: number }> {
    this.logger.log('🔔 Starting low stock check...');

    let processed = 0;
    let notificationsSent = 0;

    try {
      // 1. Obtener todos los commerces activos
      const commerces = await this.commerceService.getCommerces();

      for (const commerce of commerces) {
        try {
          // 2. Verificar si tiene el toggle activo para LOW_STOCK
          const featureToggle = await this.featureToggleService.getFeatureToggleByNameAndCommerceId(
            commerce.id,
            'system-notifications-low-stock'
          );

          if (!featureToggle || !featureToggle.active) {
            this.logger.log(`Skipping commerce ${commerce.id}: low-stock notifications disabled`);
            continue;
          }

          // 3. Obtener productos activos del commerce
          const products = await this.productService.getActiveProductsByCommerce(commerce.id);
          processed += products.length;

          // 4. Filtrar productos con stock bajo (actualLevel < replacementLevel)
          const lowStockProducts = products.filter(
            p =>
              p.actualLevel !== undefined &&
              p.replacementLevel !== undefined &&
              p.actualLevel < p.replacementLevel
          );

          this.logger.log(
            `Commerce ${commerce.id}: ${lowStockProducts.length}/${products.length} products with low stock`
          );

          // 5. Para cada producto verificar si debemos notificar
          for (const product of lowStockProducts) {
            const sent = await this.processLowStockProduct(commerce.id, product);
            if (sent) notificationsSent++;
          }
        } catch (error) {
          this.logger.error(`Error processing commerce ${commerce.id}:`, error.stack);
        }
      }

      this.logger.log(
        `✅ Low stock check complete: ${processed} products checked, ${notificationsSent} notifications sent`
      );
      return { processed, notificationsSent };
    } catch (error) {
      this.logger.error('Error in checkLowStockProducts:', error.stack);
      throw error;
    }
  }

  /**
   * Endpoint HTTP para chequear lotes próximos a vencer
   * Llamado por GCP Scheduler
   */
  async checkExpiringBatches(): Promise<{ processed: number; notificationsSent: number }> {
    this.logger.log('🔔 Starting expiring batches check...');

    let processed = 0;
    let notificationsSent = 0;

    try {
      const commerces = await this.commerceService.getCommerces();

      for (const commerce of commerces) {
        try {
          const featureToggle = await this.featureToggleService.getFeatureToggleByNameAndCommerceId(
            commerce.id,
            'system-notifications-expiring-batches'
          );

          if (!featureToggle || !featureToggle.active) {
            this.logger.log(
              `Skipping commerce ${commerce.id}: expiring-batches notifications disabled`
            );
            continue;
          }

          const replacements = await this.productService.getActiveReplacementsByCommerce(
            commerce.id
          );
          processed += replacements.length;

          const now = new Date();
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(now.getDate() + 30);

          const expiringReplacements = replacements.filter(r => {
            if (!r.replacementExpirationDate) return false;
            const expDate =
              r.replacementExpirationDate instanceof Date
                ? r.replacementExpirationDate
                : new Date(r.replacementExpirationDate);
            return expDate <= thirtyDaysFromNow && expDate >= now;
          });

          this.logger.log(
            `Commerce ${commerce.id}: ${expiringReplacements.length}/${replacements.length} batches expiring within 30 days`
          );

          for (const replacement of expiringReplacements) {
            const sent = await this.processExpiringBatch(commerce.id, replacement);
            if (sent) notificationsSent++;
          }
        } catch (error) {
          this.logger.error(`Error processing commerce ${commerce.id}:`, error.stack);
        }
      }

      this.logger.log(
        `✅ Expiring batches check complete: ${processed} batches checked, ${notificationsSent} notifications sent`
      );
      return { processed, notificationsSent };
    } catch (error) {
      this.logger.error('Error in checkExpiringBatches:', error.stack);
      throw error;
    }
  }

  /**
   * Procesar un producto con stock bajo
   */
  private async processLowStockProduct(commerceId: string, product: Product): Promise<boolean> {
    const trackingId = `${commerceId}_LOW_STOCK_${product.id}`;

    try {
      // Buscar tracking existente
      let tracking = await this.trackingRepository.findById(trackingId).catch(() => null);

      const now = new Date();

      if (!tracking) {
        // Primera vez que detectamos este problema
        tracking = new SystemNotificationTracking();
        tracking.id = trackingId;
        tracking.commerceId = commerceId;
        tracking.category = MessageCategory.LOW_STOCK;
        tracking.entityType = 'product';
        tracking.entityId = product.id;
        tracking.firstDetectedAt = now;
        tracking.sentCount = 0;
        tracking.resolved = false;
        tracking.maxSent = false;
        tracking.lastKnownData = {};
        tracking.createdAt = now;
      }

      // Verificar si se resolvió (stock subió >20% sobre el mínimo)
      if (product.actualLevel >= product.replacementLevel * 1.2) {
        if (!tracking.resolved) {
          tracking.resolved = true;
          tracking.resolvedAt = now;
          tracking.updatedAt = now;
          await this.trackingRepository.update(tracking);
          this.logger.log(`Product ${product.id} stock issue resolved`);
        }
        return false; // No notificar si está resuelto
      }

      // Verificar si ya llegó al máximo de envíos
      if (tracking.maxSent) {
        this.logger.log(
          `Product ${product.id}: max notifications reached (${tracking.sentCount}/6), skipping`
        );
        return false;
      }

      // Verificar si ya es tiempo de enviar
      if (tracking.nextAllowedSendAt && now < tracking.nextAllowedSendAt) {
        this.logger.log(
          `Product ${
            product.id
          }: next notification allowed at ${tracking.nextAllowedSendAt.toISOString()}, skipping`
        );
        return false;
      }

      // 🚀 ENVIAR NOTIFICACIÓN
      await this.sendLowStockNotifications(commerceId, product);

      // Actualizar tracking
      tracking.lastSentAt = now;
      tracking.sentCount += 1;
      tracking.lastKnownData = {
        currentStock: product.actualLevel,
        minStock: product.replacementLevel,
        productName: product.name,
      };
      tracking.nextAllowedSendAt = this.calculateNextAllowedSend(
        tracking.sentCount,
        tracking.firstDetectedAt
      );
      tracking.maxSent = tracking.sentCount >= 6;
      tracking.updatedAt = now;

      if (tracking.sentCount === 1) {
        await this.trackingRepository.create(tracking);
      } else {
        await this.trackingRepository.update(tracking);
      }

      this.logger.log(`Notification sent for product ${product.id} (${tracking.sentCount}/6)`);
      return true;
    } catch (error) {
      this.logger.error(`Error processing product ${product.id}:`, error.stack);
      return false;
    }
  }

  /**
   * Enviar notificaciones a todos los usuarios admin del commerce
   */
  private async sendLowStockNotifications(commerceId: string, product: Product): Promise<void> {
    try {
      const commerce = await this.commerceService.getCommerce(commerceId);

      const administrators = await this.administratorService.getAdministratorsByCommerce(
        commerce.businessId,
        commerceId
      );

      if (administrators.length === 0) {
        this.logger.warn(`No administrators found for commerce ${commerceId}`);
        return;
      }

      const language = commerce.localeInfo?.language || 'pt';

      const messages = this.getTranslatedMessages(language, 'LOW_STOCK', {
        productName: product.name,
        currentStock: product.actualLevel,
        reorderLevel: product.replacementLevel,
      });

      for (const administrator of administrators) {
        try {
          await this.internalMessageService.sendSystemNotification({
            category: MessageCategory.LOW_STOCK,
            priority: MessagePriority.HIGH,
            title: messages.title,
            content: messages.content,
            icon: 'inventory_2',
            actionLink: `/internal/inventory/products/${product.id}`,
            actionLabel: messages.actionLabel,
            recipientId: administrator.id,
            recipientType: 'business',
            commerceId: commerceId,
            productId: product.id,
          });

          this.logger.log(
            `Notification sent to administrator ${administrator.id} for product ${product.id}`
          );
        } catch (error) {
          this.logger.error(
            `Error sending notification to administrator ${administrator.id}:`,
            error.stack
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error in sendLowStockNotifications:`, error.stack);
      throw error;
    }
  }

  /**
   * Procesar un lote próximo a vencer
   */
  private async processExpiringBatch(
    commerceId: string,
    replacement: ProductReplacement
  ): Promise<boolean> {
    const trackingId = `${commerceId}_EXPIRING_BATCH_${replacement.id}`;

    try {
      let tracking = await this.trackingRepository.findById(trackingId).catch(() => null);

      const now = new Date();

      if (!tracking) {
        tracking = new SystemNotificationTracking();
        tracking.id = trackingId;
        tracking.commerceId = commerceId;
        tracking.category = MessageCategory.EXPIRING_BATCH;
        tracking.entityType = 'product-replacement';
        tracking.entityId = replacement.id;
        tracking.firstDetectedAt = now;
        tracking.sentCount = 0;
        tracking.resolved = false;
        tracking.maxSent = false;
        tracking.lastKnownData = {};
        tracking.createdAt = now;
      }

      if (tracking.maxSent) {
        this.logger.log(
          `Batch ${replacement.id}: max notifications reached (${tracking.sentCount}/6), skipping`
        );
        return false;
      }

      if (tracking.nextAllowedSendAt && now < tracking.nextAllowedSendAt) {
        this.logger.log(
          `Batch ${
            replacement.id
          }: next notification allowed at ${tracking.nextAllowedSendAt.toISOString()}, skipping`
        );
        return false;
      }

      const expDate =
        replacement.replacementExpirationDate instanceof Date
          ? replacement.replacementExpirationDate
          : new Date(replacement.replacementExpirationDate);
      const daysToExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let product: Product;
      try {
        product = await this.productRepository.findById(replacement.productId);
      } catch {
        this.logger.warn(`Product ${replacement.productId} not found for batch ${replacement.id}`);
        return false;
      }

      await this.sendExpiringBatchNotifications(
        commerceId,
        product,
        replacement,
        daysToExpiry,
        expDate
      );

      tracking.lastSentAt = now;
      tracking.sentCount += 1;
      tracking.lastKnownData = {
        productName: product.name,
        batchCode: replacement.code,
        daysToExpiry,
        expirationDate: expDate.toISOString(),
      };
      tracking.nextAllowedSendAt = this.calculateNextAllowedSend(
        tracking.sentCount,
        tracking.firstDetectedAt
      );
      tracking.maxSent = tracking.sentCount >= 6;
      tracking.updatedAt = now;

      if (tracking.sentCount === 1) {
        await this.trackingRepository.create(tracking);
      } else {
        await this.trackingRepository.update(tracking);
      }

      this.logger.log(`Notification sent for batch ${replacement.id} (${tracking.sentCount}/6)`);
      return true;
    } catch (error) {
      this.logger.error(`Error processing batch ${replacement.id}:`, error.stack);
      return false;
    }
  }

  /**
   * Enviar notificaciones de lotes por vencer a los administradores del commerce
   */
  private async sendExpiringBatchNotifications(
    commerceId: string,
    product: Product,
    replacement: ProductReplacement,
    daysToExpiry: number,
    expirationDate: Date
  ): Promise<void> {
    try {
      const commerce = await this.commerceService.getCommerce(commerceId);

      const administrators = await this.administratorService.getAdministratorsByCommerce(
        commerce.businessId,
        commerceId
      );

      if (administrators.length === 0) {
        this.logger.warn(`No administrators found for commerce ${commerceId}`);
        return;
      }

      const language = commerce.localeInfo?.language || 'pt';

      const messages = this.getTranslatedMessages(language, 'EXPIRING_BATCH', {
        productName: product.name,
        batchNumber: replacement.code || replacement.id,
        daysToExpiry,
        expiryDate: expirationDate.toLocaleDateString(),
      });

      for (const administrator of administrators) {
        try {
          await this.internalMessageService.sendSystemNotification({
            category: MessageCategory.EXPIRING_BATCH,
            priority: daysToExpiry <= 7 ? MessagePriority.HIGH : MessagePriority.NORMAL,
            title: messages.title,
            content: messages.content,
            icon: 'event_busy',
            actionLink: `/internal/inventory/products/${product.id}`,
            actionLabel: messages.actionLabel,
            recipientId: administrator.id,
            recipientType: 'business',
            commerceId: commerceId,
            productId: product.id,
          });

          this.logger.log(
            `Expiring batch notification sent to administrator ${administrator.id} for batch ${replacement.id}`
          );
        } catch (error) {
          this.logger.error(
            `Error sending expiring batch notification to administrator ${administrator.id}:`,
            error.stack
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error in sendExpiringBatchNotifications:`, error.stack);
      throw error;
    }
  }

  /**
   * Calcular próxima fecha permitida de envío según estrategia
   */
  private calculateNextAllowedSend(sentCount: number, firstSent: Date): Date {
    const intervalsInDays = [
      0, // Día 0: Primera notificación
      3, // Día 3: Segundo recordatorio
      7, // Día 7: Tercer recordatorio
      14, // Día 14: Cuarto recordatorio
      21, // Día 21: Quinto recordatorio
      30, // Día 30: Sexto y último recordatorio
    ];

    if (sentCount >= intervalsInDays.length) {
      // Llegó al máximo, no enviar más hasta que se resuelva
      return new Date('2099-12-31');
    }

    const nextInterval = intervalsInDays[sentCount];
    const nextDate = new Date(firstSent);
    nextDate.setDate(nextDate.getDate() + nextInterval);
    return nextDate;
  }

  /**
   * Obtener mensajes traducidos según idioma
   */
  private getTranslatedMessages(
    language: string,
    type: string,
    data: any
  ): { title: string; content: string; actionLabel: string } {
    const translations = {
      LOW_STOCK: {
        pt: {
          title: 'Estoque Baixo',
          content: `O produto "${data.productName}" está com estoque baixo (${data.currentStock} unidades). Nível mínimo: ${data.reorderLevel}.`,
          actionLabel: 'Ver Produto',
        },
        es: {
          title: 'Stock Bajo',
          content: `El producto "${data.productName}" tiene stock bajo (${data.currentStock} unidades). Nivel mínimo: ${data.reorderLevel}.`,
          actionLabel: 'Ver Producto',
        },
        en: {
          title: 'Low Stock',
          content: `Product "${data.productName}" is running low (${data.currentStock} units). Minimum level: ${data.reorderLevel}.`,
          actionLabel: 'View Product',
        },
      },
      EXPIRING_BATCH: {
        pt: {
          title: 'Lote Próximo ao Vencimento',
          content: `O lote "${data.batchNumber}" do produto "${data.productName}" vence em ${data.daysToExpiry} dias (${data.expiryDate}).`,
          actionLabel: 'Ver Lote',
        },
        es: {
          title: 'Lote Próximo a Vencer',
          content: `El lote "${data.batchNumber}" del producto "${data.productName}" vence en ${data.daysToExpiry} días (${data.expiryDate}).`,
          actionLabel: 'Ver Lote',
        },
        en: {
          title: 'Expiring Batch',
          content: `Batch "${data.batchNumber}" of product "${data.productName}" expires in ${data.daysToExpiry} days (${data.expiryDate}).`,
          actionLabel: 'View Batch',
        },
      },
    };

    return translations[type]?.[language] || translations[type]?.['en'];
  }
}
