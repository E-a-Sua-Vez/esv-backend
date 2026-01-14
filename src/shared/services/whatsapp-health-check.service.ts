import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { AdministratorService } from '../../administrator/administrator.service';
import { Business, WhatsappConnection } from '../../business/model/business.entity';
import { BusinessService } from '../../business/business.service';
import { InternalMessageService } from '../../internal-message/internal-message.service';
import { MessageCategory } from '../../internal-message/model/message-category.enum';
import { MessagePriority } from '../../internal-message/model/message-priority.enum';

/**
 * Health-check periódico de conexiones WhatsApp por negocio.
 *
 * - Revisa periódicamente el estado de las conexiones en WhatsGw.
 * - Actualiza el flag `connected` vía BusinessService.statusWhatsappConnectionById.
 * - Cuando detecta una transición de conectado -> desconectado, envía una
 *   notificación interna al negocio para que vuelva a escanear el QR.
 */
@Injectable()
export class WhatsappHealthCheckService {
  private readonly logger = new Logger(WhatsappHealthCheckService.name);

  constructor(
    @InjectRepository(Business)
    private businessRepository = getRepository(Business),
    private readonly businessService: BusinessService,
    @Inject(forwardRef(() => InternalMessageService))
    private readonly internalMessageService: InternalMessageService,
    private readonly administratorService: AdministratorService
  ) {}

  // Ejecutar cada 15 minutos. Ajustable si es necesario.
  @Cron('*/15 * * * *')
  async checkWhatsappConnections(): Promise<void> {
    this.logger.log('Starting periodic WhatsApp connection health check');

    let businesses: Business[] = [];
    try {
      // Solo negocios activos para reducir carga
      businesses = await this.businessRepository.whereEqualTo('active', true).find();
    } catch (error) {
      this.logger.error(`Error loading businesses for WhatsApp health check: ${error.message}`);
      return;
    }

    for (const business of businesses) {
      try {
        if (!business.whatsappConnection || !business.whatsappConnection.whatsapp) {
          continue;
        }

        const prevConnected = business.whatsappConnection.connected === true;

        let updatedConnection: WhatsappConnection | undefined;
        try {
          updatedConnection = await this.businessService.statusWhatsappConnectionById(
            'system',
            business.id
          );
        } catch (error) {
          this.logger.warn(
            `Failed to refresh WhatsApp status for business ${business.id}: ${error.message}`
          );
          continue;
        }

        if (!updatedConnection) {
          continue;
        }

        const nowConnected = updatedConnection.connected === true;

        // Detectar transición conectado -> desconectado
        if (prevConnected && !nowConnected) {
          await this.notifyWhatsappDisconnected(business, updatedConnection);
        }
      } catch (error) {
        this.logger.error(
          `Unexpected error during WhatsApp health check for business ${business?.id}: ${error.message}`,
          error.stack
        );
      }
    }

    this.logger.log('Finished periodic WhatsApp connection health check');
  }

  private async notifyWhatsappDisconnected(
    business: Business,
    connection: WhatsappConnection
  ): Promise<void> {
    try {
      // Obtener administradores del negocio usando el servicio de dominio
      const administrators = await this.administratorService.getAdministratorsByBusinessId(
        business.id
      );

      // Determinar idioma base a partir del negocio (por defecto, español)
      const language = (business.localeInfo && (business.localeInfo.language as any)) || 'es';

      const titleByLang: Record<string, string> = {
        es: 'Conexión de WhatsApp desconectada',
        pt: 'Conexão do WhatsApp desconectada',
        en: 'WhatsApp connection disconnected',
      };

      const contentByLang: Record<string, string> = {
        es:
          `La conexión de WhatsApp del negocio "${business.name}" se ha desconectado. ` +
          `Por favor ingresa a la configuración del negocio y vuelve a escanear el código QR para restablecer la conexión.`,
        pt:
          `A conexão do WhatsApp do negócio "${business.name}" foi desconectada. ` +
          `Por favor acesse a configuração do negócio e escaneie novamente o código QR para restabelecer a conexão.`,
        en:
          `The WhatsApp connection for business "${business.name}" has been disconnected. ` +
          `Please go to the business settings and scan the QR code again to restore the connection.`,
      };

      const title = titleByLang[language] || titleByLang.es;
      const content = contentByLang[language] || contentByLang.es;

      // Si hay administradores, enviar a cada uno
      if (administrators && administrators.length > 0) {
        for (const administrator of administrators) {
          if (administrator.active === true && administrator.master !== true) {
            await this.internalMessageService.sendSystemNotification({
              category: MessageCategory.SYSTEM_UPDATE,
              priority: MessagePriority.HIGH,
              title,
              content,
              icon: 'bi-whatsapp',
              actionLink: '/interno/negocio/configuration',
              actionLabel: 'Revisar conexión WhatsApp',
              recipientId: administrator.id,
              recipientType: 'business',
              commerceId: undefined,
              attentionId: undefined,
              bookingId: undefined,
              queueId: undefined,
              productId: undefined,
              clientId: undefined,
              documentId: undefined,
              taskId: undefined,
              expiresAt: undefined,
            });

            this.logger.log(
              `Sent internal notification about WhatsApp disconnection for administrator ${administrator.id} (business ${business.id})`
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to send internal notification for WhatsApp disconnection (business ${business.id}): ${error.message}`,
        error.stack
      );
    }
  }
}
