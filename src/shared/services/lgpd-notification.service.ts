import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { NotificationService } from '../../notification/notification.service';
import { NotificationType } from '../../notification/model/notification-type.enum';
import { ClientService } from '../../client/client.service';
import { CommerceService } from '../../commerce/commerce.service';
import { getLgpdMessages, getLgpdInternalMessages } from '../messages/lgpd-messages';

/**
 * Serviço de notificações LGPD
 * Envia notificações automáticas para titulares e ANPD conforme LGPD
 */
@Injectable()
export class LgpdNotificationService {
  private readonly logger = new Logger(LgpdNotificationService.name);

  constructor(
    @Optional() @Inject(NotificationService) private notificationService?: NotificationService,
    @Optional() @Inject(ClientService) private clientService?: ClientService,
    @Optional() @Inject(CommerceService) private commerceService?: CommerceService
  ) {}

  /**
   * Notificar titular sobre consentimento
   */
  async notifyConsentGranted(
    clientId: string,
    commerceId: string,
    consentType: string,
    purpose: string
  ): Promise<void> {
    try {
      if (!this.notificationService || !this.clientService) {
        this.logger.warn('NotificationService or ClientService not available');
        return;
      }

      const client = await this.clientService.getClientById(clientId);
      if (!client) {
        this.logger.warn(`Client not found: ${clientId}`);
        return;
      }

      const commerce = await this.commerceService?.getCommerceById(commerceId);
      const commerceName = commerce?.name || getLgpdMessages().defaultCommerceName;

      // Obtener idioma del comercio (por defecto 'pt')
      const language = commerce?.localeInfo?.language || 'pt';
      const messages = getLgpdMessages(language);

      // Notificar por email se disponible
      if (client.email) {
        try {
          await this.notificationService.createEmailNotification(
            client.email,
            clientId,
            NotificationType.OTHER,
            '', // attentionId
            commerceId,
            '', // queueId
            'lgpd-consent-granted',
            0, // attentionNumber
            commerceName,
            '', // link
            '', // logo
            '', // moduleNumber
            '' // collaboratorName
          );
        } catch (error) {
          this.logger.error(`Error sending email notification: ${error.message}`);
        }
      }

      // Notificar por WhatsApp si el cliente tiene teléfono
      if (client.phone) {
        try {
          const message = messages.consentGranted(client.name, purpose, commerceName);
          await this.notificationService.createWhatsappNotification(
            client.phone,
            clientId,
            message,
            NotificationType.OTHER,
            '', // attentionId
            commerceId,
            '', // queueId
            '' // servicePhoneNumber
          );
        } catch (error) {
          this.logger.error(`Error sending WhatsApp notification: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error notifying consent granted: ${error.message}`, error.stack);
    }
  }

  /**
   * Notificar titular sobre revogação de consentimento
   */
  async notifyConsentRevoked(
    clientId: string,
    commerceId: string,
    consentType: string,
    purpose: string,
    reason: string
  ): Promise<void> {
    try {
      if (!this.notificationService || !this.clientService) {
        return;
      }

      const client = await this.clientService.getClientById(clientId);
      if (!client) return;

      const commerce = await this.commerceService?.getCommerceById(commerceId);
      const commerceName = commerce?.name || getLgpdMessages().defaultCommerceName;

      // Obtener idioma del comercio (por defecto 'pt')
      const language = commerce?.localeInfo?.language || 'pt';
      const messages = getLgpdMessages(language);

      if (client.email) {
        try {
          await this.notificationService.createEmailNotification(
            client.email,
            clientId,
            NotificationType.OTHER,
            '',
            commerceId,
            '',
            'lgpd-consent-revoked',
            0,
            commerceName,
            '',
            '',
            '',
            ''
          );
        } catch (error) {
          this.logger.error(`Error sending email notification: ${error.message}`);
        }
      }

      if (client.phone) {
        try {
          const message = messages.consentRevoked(client.name, purpose, commerceName, reason);
          await this.notificationService.createWhatsappNotification(
            client.phone,
            clientId,
            message,
            NotificationType.OTHER,
            '',
            commerceId,
            '',
            ''
          );
        } catch (error) {
          this.logger.error(`Error sending WhatsApp notification: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error notifying consent revoked: ${error.message}`, error.stack);
    }
  }

  /**
   * Notificar titular sobre portabilidade de dados
   */
  async notifyDataPortabilityReady(
    clientId: string,
    commerceId: string,
    fileName: string,
    downloadUrl: string
  ): Promise<void> {
    try {
      if (!this.notificationService || !this.clientService) {
        return;
      }

      const client = await this.clientService.getClientById(clientId);
      if (!client) return;

      const commerce = await this.commerceService?.getCommerceById(commerceId);
      const commerceName = commerce?.name || getLgpdMessages().defaultCommerceName;

      // Obtener idioma del comercio (por defecto 'pt')
      const language = commerce?.localeInfo?.language || 'pt';
      const messages = getLgpdMessages(language);

      if (client.email) {
        try {
          await this.notificationService.createEmailNotification(
            client.email,
            clientId,
            NotificationType.OTHER,
            '',
            commerceId,
            '',
            'lgpd-data-portability',
            0,
            commerceName,
            downloadUrl,
            '',
            '',
            ''
          );
        } catch (error) {
          this.logger.error(`Error sending email notification: ${error.message}`);
        }
      }

      if (client.phone) {
        try {
          const message = messages.dataPortabilityReady(client.name, downloadUrl);
          await this.notificationService.createWhatsappNotification(
            client.phone,
            clientId,
            message,
            NotificationType.OTHER,
            '',
            commerceId,
            '',
            ''
          );
        } catch (error) {
          this.logger.error(`Error sending WhatsApp notification: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error notifying data portability: ${error.message}`, error.stack);
    }
  }

  /**
   * Notificar titular sobre incidente de segurança
   * Conformidade: LGPD Artigo 48
   */
  async notifySecurityIncident(
    clientId: string,
    commerceId: string,
    incidentType: string,
    severity: string,
    description: string,
    actionsTaken: string
  ): Promise<void> {
    try {
      if (!this.notificationService || !this.clientService) {
        return;
      }

      const client = await this.clientService.getClientById(clientId);
      if (!client) return;

      const commerce = await this.commerceService?.getCommerceById(commerceId);
      const commerceName = commerce?.name || getLgpdMessages().defaultCommerceName;

      // Obtener idioma del comercio (por defecto 'pt')
      const language = commerce?.localeInfo?.language || 'pt';
      const messages = getLgpdMessages(language);

      if (client.email) {
        try {
          await this.notificationService.createEmailNotification(
            client.email,
            clientId,
            NotificationType.OTHER,
            '',
            commerceId,
            '',
            'lgpd-security-incident',
            0,
            commerceName,
            '',
            '',
            '',
            ''
          );
        } catch (error) {
          this.logger.error(`Error sending email notification: ${error.message}`);
        }
      }

      if (client.phone) {
        try {
          const message = messages.securityIncident(client.name, commerceName, incidentType, severity, actionsTaken);
          await this.notificationService.createWhatsappNotification(
            client.phone,
            clientId,
            message,
            NotificationType.OTHER,
            '',
            commerceId,
            '',
            ''
          );
        } catch (error) {
          this.logger.error(`Error sending WhatsApp notification: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error notifying security incident: ${error.message}`, error.stack);
    }
  }

  /**
   * Notificar ANPD sobre incidente crítico
   * Conformidade: LGPD Artigo 48
   * NOTA: Esta función prepara los datos para notificación. La notificación real a ANPD
   * debe hacerse a través del portal oficial de la ANPD o API cuando esté disponible.
   */
  async prepareAnpdNotification(
    incidentId: string,
    commerceId: string,
    incidentType: string,
    severity: string,
    affectedDataSubjects: number,
    description: string
  ): Promise<{
    ready: boolean;
    notificationData: {
      incidentId: string;
      commerceId: string;
      incidentType: string;
      severity: string;
      affectedDataSubjects: number;
      description: string;
      reportedAt: Date;
    };
    anpdPortalUrl: string;
  }> {
    // Preparar datos para notificación ANPD
    // La notificación real debe hacerse manualmente o vía API cuando esté disponible
    const notificationData = {
      incidentId,
      commerceId,
      incidentType,
      severity,
      affectedDataSubjects,
      description,
      reportedAt: new Date(),
    };

    // Obtener idioma (por defecto 'pt')
    const language = 'pt'; // Para mensajes internos, usar portugués por defecto
    const internalMessages = getLgpdInternalMessages(language);

    // URL del portal de notificaciones de la ANPD
    const anpdPortalUrl = internalMessages.anpdPortalUrl;

    this.logger.warn(
      internalMessages.anpdNotificationPrepared(anpdPortalUrl),
      notificationData
    );

    return {
      ready: true,
      notificationData,
      anpdPortalUrl,
    };
  }
}

