import { Injectable, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { LgpdConsent, ConsentStatus } from '../model/lgpd-consent.entity';
import { ConsentRequirement, ConsentRequestMethod } from '../model/consent-requirement.entity';
import { ConsentOrchestrationService } from './consent-orchestration.service';
import { ConsentTriggersService } from './consent-triggers.service';
import { NotificationService } from '../../notification/notification.service';
import { NotificationType } from '../../notification/model/notification-type.enum';
import { ClientService } from '../../client/client.service';
import { CommerceService } from '../../commerce/commerce.service';

/**
 * Serviço para gerenciar expiração e renovação de consentimentos
 * Executa verificações periódicas e notifica sobre expirações
 */
@Injectable()
export class ConsentExpirationService {
  private readonly logger = new Logger(ConsentExpirationService.name);

  constructor(
    @InjectRepository(LgpdConsent)
    private lgpdConsentRepository = getRepository(LgpdConsent),
    @InjectRepository(ConsentRequirement)
    private requirementRepository = getRepository(ConsentRequirement),
    @Inject(forwardRef(() => ConsentOrchestrationService))
    private consentOrchestrationService: ConsentOrchestrationService,
    @Inject(forwardRef(() => ClientService))
    private clientService: ClientService,
    @Inject(forwardRef(() => CommerceService))
    private commerceService: CommerceService,
    @Optional() @Inject(forwardRef(() => ConsentTriggersService))
    private consentTriggersService?: ConsentTriggersService,
    @Optional() @Inject(forwardRef(() => NotificationService))
    private notificationService?: NotificationService
  ) {}

  /**
   * Job diário para verificar consentimentos expirados
   * Executa todos os dias à meia-noite
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkExpiredConsents(): Promise<void> {
    this.logger.log('Starting daily check for expired consents');
    try {
      const now = new Date();

      // Buscar todos os consentimentos GRANTED e filtrar os que expiraram
      const allGrantedConsents = await this.lgpdConsentRepository
        .whereEqualTo('status', ConsentStatus.GRANTED)
        .find();

      // Filtrar os que têm expiresAt e já expiraram
      const expiredConsents = allGrantedConsents.filter(
        consent => consent.expiresAt && consent.expiresAt < now
      );

      this.logger.log(`Found ${expiredConsents.length} expired consents`);

      for (const consent of expiredConsents) {
        try {
          // Marcar como expirado
          consent.status = ConsentStatus.EXPIRED;
          consent.updatedAt = new Date();

          // Adicionar ao histórico
          if (!consent.history) {
            consent.history = [];
          }
          consent.history.push({
            timestamp: new Date(),
            action: 'EXPIRED',
            performedBy: 'system',
            reason: 'Automatic expiration check'
          });

          await this.lgpdConsentRepository.update(consent);
          this.logger.log(`Marked consent ${consent.id} as expired`);

          // Enviar notificação de expiração ao cliente
          try {
            await this.sendExpirationNotification(consent);
          } catch (notifError) {
            this.logger.warn(`Error sending expiration notification for consent ${consent.id}: ${notifError.message}`);
          }
        } catch (error) {
          this.logger.error(`Error marking consent ${consent.id} as expired: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error checking expired consents: ${error.message}`, error.stack);
    }
  }

  /**
   * Envia notificação de expiração ao cliente quando o consentimento expira
   */
  private async sendExpirationNotification(consent: LgpdConsent): Promise<void> {
    try {
      if (!this.notificationService) {
        this.logger.warn('NotificationService not available');
        return;
      }

      const client = await this.clientService.getClientById(consent.clientId);
      if (!client) {
        this.logger.warn(`Client ${consent.clientId} not found for expiration notification`);
        return;
      }

      const commerce = await this.commerceService.getCommerceById(consent.commerceId);
      if (!commerce) {
        this.logger.warn(`Commerce ${consent.commerceId} not found for expiration notification`);
        return;
      }

      // Obtener el requisito para obtener los templates
      const requirement = await this.requirementRepository
        .whereEqualTo('commerceId', consent.commerceId)
        .whereEqualTo('consentType', consent.consentType)
        .whereEqualTo('active', true)
        .findOne();

      const consentTypeLabel = requirement?.consentType || consent.consentType;
      const expirationDate = consent.expiresAt ? new Date(consent.expiresAt).toLocaleDateString('pt-BR') : '';

      // Enviar notificação por email se disponível
      if (client.email) {
        try {
          const emailMessage = `
            <h2>${commerce.name} - Consentimento LGPD Expirado</h2>
            <p>Estimado/a cliente,</p>
            <p>Seu consentimento LGPD para <strong>${consentTypeLabel}</strong> expirou em <strong>${expirationDate}</strong>.</p>
            <p>Para continuar utilizando nossos serviços, é necessário renovar seu consentimento.</p>
            <p>Por favor, acesse nosso portal do cliente para renovar seu consentimento.</p>
            <p>Obrigado pela sua atenção.</p>
          `;
          await this.notificationService.createEmailNotification(
            client.email,
            consent.clientId,
            NotificationType.LGPD_CONSENT_EXPIRED,
            undefined, // attentionId
            consent.commerceId,
            undefined, // queueId
            emailMessage, // template
            undefined, // attentionNumber
            commerce.name, // commerce
            undefined, // link
            commerce.logo || '', // logo
            undefined, // moduleNumber
            undefined // collaboratorName
          );
          this.logger.log(`Expiration notification email sent to ${client.email} for consent ${consent.id}`);
        } catch (emailError) {
          this.logger.warn(`Error sending expiration email: ${emailError.message}`);
        }
      }

      // Enviar notificação por WhatsApp se disponível
      if (client.phone && this.consentTriggersService) {
        try {
          const whatsappMessage = `*${commerce.name}*\n\nSeu consentimento LGPD para *${consentTypeLabel}* expirou em *${expirationDate}*.\n\nPor favor, acesse o portal do cliente para renovar seu consentimento.`;
          // Usar número del comercio solo si la conexión está activa, sino usar default
          const servicePhoneNumber = (commerce.whatsappConnection?.connected && commerce.whatsappConnection?.whatsapp) 
            ? commerce.whatsappConnection.whatsapp 
            : process.env.WHATSGW_PHONE_NUMBER;
          await this.notificationService.createWhatsappNotification(
            client.phone,
            consent.clientId,
            whatsappMessage,
            NotificationType.LGPD_CONSENT_EXPIRED,
            undefined, // attentionId
            consent.commerceId,
            undefined, // queueId
            servicePhoneNumber
          );
          this.logger.log(`Expiration notification WhatsApp sent to ${client.phone} for consent ${consent.id}`);
        } catch (whatsappError) {
          this.logger.warn(`Error sending expiration WhatsApp: ${whatsappError.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error sending expiration notification: ${error.message}`, error.stack);
    }
  }

  /**
   * Job diário para verificar consentimentos próximos a expirar
   * Executa todos os dias às 6h da manhã
   */
  @Cron('0 6 * * *') // 6 AM daily
  async checkUpcomingExpirations(): Promise<void> {
    this.logger.log('Starting daily check for upcoming consent expirations');
    try {
      const now = new Date();

      // Buscar todos os requisitos que têm renewalReminderDays configurado
      const requirements = await this.requirementRepository
        .whereEqualTo('active', true)
        .find();

      for (const requirement of requirements) {
        if (!requirement.requestStrategy?.renewalReminderDays) {
          continue;
        }

        const reminderDays = requirement.requestStrategy.renewalReminderDays;
        const reminderDate = new Date(now);
        reminderDate.setDate(reminderDate.getDate() + reminderDays);

        // Buscar consentimentos que expirarão no período de lembrete
        const allConsents = await this.lgpdConsentRepository
          .whereEqualTo('commerceId', requirement.commerceId)
          .whereEqualTo('consentType', requirement.consentType)
          .whereEqualTo('status', ConsentStatus.GRANTED)
          .find();

        // Filtrar os que expirarão no período de lembrete
        const upcomingExpirations = allConsents.filter(
          consent =>
            consent.expiresAt &&
            consent.expiresAt >= now &&
            consent.expiresAt <= reminderDate
        );

        for (const consent of upcomingExpirations) {
          try {
            await this.sendExpirationReminder(consent, requirement);
          } catch (error) {
            this.logger.error(
              `Error sending expiration reminder for consent ${consent.id}: ${error.message}`
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error checking upcoming expirations: ${error.message}`, error.stack);
    }
  }

  /**
   * Envia lembrete de expiração para o cliente
   */
  private async sendExpirationReminder(
    consent: LgpdConsent,
    requirement: ConsentRequirement
  ): Promise<void> {
    try {
      const client = await this.clientService.getClientById(consent.clientId);
      const commerce = await this.commerceService.getCommerceById(consent.commerceId);

      if (!client || !commerce) {
        this.logger.warn(`Client or commerce not found for consent ${consent.id}`);
        return;
      }

      const daysUntilExpiration = Math.ceil(
        (consent.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      // Enviar notificação por email se configurado
      if (client.email && requirement.requestStrategy.methods.includes(ConsentRequestMethod.EMAIL) && this.notificationService) {
        const emailMessage = this.buildExpirationReminderEmail(
          commerce,
          consent,
          daysUntilExpiration
        );
        await this.notificationService.createEmailNotification(
          client.email,
          consent.clientId,
          NotificationType.CONSENT_REQUEST,
          undefined, // attentionId
          consent.commerceId,
          undefined, // queueId
          emailMessage, // template
          undefined, // attentionNumber
          commerce.name, // commerce
          undefined, // link
          commerce.logo || '', // logo
          undefined, // moduleNumber
          undefined // collaboratorName
        );
      }

      // Enviar notificação por WhatsApp se configurado
      if (client.phone && requirement.requestStrategy.methods.includes(ConsentRequestMethod.WHATSAPP) && this.notificationService) {
        const whatsappMessage = this.buildExpirationReminderWhatsApp(
          commerce,
          consent,
          daysUntilExpiration
        );
        // Usar número del comercio solo si la conexión está activa, sino usar default
        const servicePhoneNumber = (commerce.whatsappConnection?.connected && commerce.whatsappConnection?.whatsapp) 
          ? commerce.whatsappConnection.whatsapp 
          : process.env.WHATSGW_PHONE_NUMBER;
        await this.notificationService.createWhatsappNotification(
          client.phone,
          consent.clientId,
          whatsappMessage,
          NotificationType.CONSENT_REQUEST,
          undefined,
          consent.commerceId,
          undefined,
          servicePhoneNumber
        );
      }

      this.logger.log(`Expiration reminder sent for consent ${consent.id}`);
    } catch (error) {
      this.logger.error(`Error sending expiration reminder: ${error.message}`, error.stack);
    }
  }

  /**
   * Constrói mensagem de email para lembrete de expiração
   */
  private buildExpirationReminderEmail(
    commerce: any,
    consent: LgpdConsent,
    daysUntilExpiration: number
  ): string {
    return `
      <h2>${commerce.name} - Lembrete de Renovação de Consentimento LGPD</h2>
      <p>Estimado/a cliente,</p>
      <p>Seu consentimento para <strong>${consent.consentType}</strong> expirará em <strong>${daysUntilExpiration} dia(s)</strong>.</p>
      <p>Para continuar utilizando nossos serviços, é necessário renovar seu consentimento.</p>
      <p>Por favor, acesse nosso sistema para renovar seu consentimento.</p>
      <p>Obrigado pela sua atenção.</p>
    `;
  }

  /**
   * Constrói mensagem de WhatsApp para lembrete de expiração
   */
  private buildExpirationReminderWhatsApp(
    commerce: any,
    consent: LgpdConsent,
    daysUntilExpiration: number
  ): string {
    return `*${commerce.name}*\n\nSeu consentimento LGPD para *${consent.consentType}* expirará em *${daysUntilExpiration} dia(s)*.\n\nPor favor, renove seu consentimento para continuar utilizando nossos serviços.`;
  }

  /**
   * Processa renovação automática de consentimentos
   */
  async processAutoRenewal(consent: LgpdConsent, requirement: ConsentRequirement): Promise<void> {
    if (!requirement.requestStrategy?.autoRenew) {
      return;
    }

    try {
      this.logger.log(`Processing auto-renewal for consent ${consent.id}`);

      // Calcular nova data de expiração
      const expiresInDays = requirement.requestStrategy.expiresInDays || 365;
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + expiresInDays);

      // Atualizar consentimento
      consent.status = ConsentStatus.GRANTED;
      consent.grantedAt = new Date();
      consent.expiresAt = newExpiresAt;
      consent.updatedAt = new Date();

      // Adicionar ao histórico
      if (!consent.history) {
        consent.history = [];
      }
      consent.history.push({
        timestamp: new Date(),
        action: 'GRANTED',
        performedBy: 'system',
        reason: 'Automatic renewal'
      });

      await this.lgpdConsentRepository.update(consent);
      this.logger.log(`Consent ${consent.id} automatically renewed until ${newExpiresAt.toISOString()}`);
    } catch (error) {
      this.logger.error(`Error processing auto-renewal for consent ${consent.id}: ${error.message}`, error.stack);
    }
  }

  /**
   * Calcula data de expiração baseada no requisito
   */
  calculateExpirationDate(requirement: ConsentRequirement): Date | undefined {
    if (!requirement.requestStrategy?.expiresInDays) {
      return undefined; // Sem expiração
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + requirement.requestStrategy.expiresInDays);
    return expiresAt;
  }
}

