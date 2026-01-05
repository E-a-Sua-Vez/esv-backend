import { Injectable, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { ConsentOrchestrationService } from './consent-orchestration.service';
import { ConsentRequestTiming } from '../model/consent-requirement.entity';
import { ClientService } from '../../client/client.service';
import { CommerceService } from '../../commerce/commerce.service';

/**
 * Serviço de triggers para solicitação automática de consentimentos
 * Detecta momentos apropriados e dispara solicitações automaticamente
 */
@Injectable()
export class ConsentTriggersService {
  private readonly logger = new Logger(ConsentTriggersService.name);

  constructor(
    @Inject(forwardRef(() => ConsentOrchestrationService))
    private consentOrchestrationService: ConsentOrchestrationService,
    @Inject(forwardRef(() => ClientService))
    private clientService: ClientService,
    @Inject(forwardRef(() => CommerceService))
    private commerceService: CommerceService
  ) {}

  /**
   * Trigger para ON_REGISTRATION - quando um cliente é registrado
   */
  async triggerOnRegistration(
    commerceId: string,
    clientId: string
  ): Promise<void> {
    try {
      this.logger.log(`Triggering ON_REGISTRATION consent request for client ${clientId}`);
      await this.consentOrchestrationService.requestAllPendingConsents(
        commerceId,
        clientId,
        ConsentRequestTiming.ON_REGISTRATION,
        'system'
      );
    } catch (error) {
      this.logger.error(
        `Error triggering ON_REGISTRATION consent: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Trigger para ON_LOGIN - quando um usuário faz login
   * Verifica consentimentos expirados e solicita renovação
   */
  async triggerOnLogin(
    commerceId: string,
    clientId: string
  ): Promise<void> {
    try {
      this.logger.log(`Triggering ON_LOGIN consent check for client ${clientId}`);

      // Verificar consentimentos expirados
      const missingConsents = await this.consentOrchestrationService.getMissingConsents(
        commerceId,
        clientId
      );

      // Filtrar apenas os que devem ser solicitados no login
      const loginRequirements = missingConsents.filter(
        req => req.requestStrategy.timing === ConsentRequestTiming.ON_LOGIN
      );

      if (loginRequirements.length > 0) {
        await this.consentOrchestrationService.requestAllPendingConsents(
          commerceId,
          clientId,
          ConsentRequestTiming.ON_LOGIN,
          'system'
        );
      }
    } catch (error) {
      this.logger.error(
        `Error triggering ON_LOGIN consent: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Trigger para BEFORE_SERVICE - antes de iniciar um serviço/atenção
   */
  async triggerBeforeService(
    commerceId: string,
    clientId: string,
    serviceId?: string
  ): Promise<void> {
    try {
      this.logger.log(`Triggering BEFORE_SERVICE consent request for client ${clientId}`);
      await this.consentOrchestrationService.requestAllPendingConsents(
        commerceId,
        clientId,
        ConsentRequestTiming.BEFORE_SERVICE,
        'system'
      );
    } catch (error) {
      this.logger.error(
        `Error triggering BEFORE_SERVICE consent: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Trigger para AFTER_ATTENTION - após completar uma atenção
   */
  async triggerAfterAttention(
    commerceId: string,
    clientId: string,
    attentionId?: string
  ): Promise<void> {
    try {
      this.logger.log(`Triggering AFTER_ATTENTION consent request for client ${clientId}`);
      await this.consentOrchestrationService.requestAllPendingConsents(
        commerceId,
        clientId,
        ConsentRequestTiming.AFTER_ATTENTION,
        'system'
      );
    } catch (error) {
      this.logger.error(
        `Error triggering AFTER_ATTENTION consent: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Trigger para PERIODIC_RENEWAL - renovação periódica
   * Deve ser chamado por um job/cron
   */
  async triggerPeriodicRenewal(
    commerceId: string,
    clientId?: string
  ): Promise<void> {
    try {
      this.logger.log(`Triggering PERIODIC_RENEWAL consent request for commerce ${commerceId}`);

      if (clientId) {
        // Renovação para um cliente específico
        await this.consentOrchestrationService.requestAllPendingConsents(
          commerceId,
          clientId,
          ConsentRequestTiming.PERIODIC_RENEWAL,
          'system'
        );
      } else {
        // Renovação para todos os clientes do comércio
        // TODO: Implementar quando necessário
        this.logger.warn('Periodic renewal for all clients not yet implemented');
      }
    } catch (error) {
      this.logger.error(
        `Error triggering PERIODIC_RENEWAL consent: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Verifica se há consentimentos obrigatórios pendentes que bloqueiam atenção
   */
  async checkBlockingConsents(
    clientId: string,
    commerceId: string
  ): Promise<{ blocked: boolean; missingConsents: string[] }> {
    try {
      const missingConsents = await this.consentOrchestrationService.getMissingConsents(
        commerceId,
        clientId
      );

      const blockingConsents = missingConsents.filter(
        req => req.blockingForAttention && req.required
      );

      return {
        blocked: blockingConsents.length > 0,
        missingConsents: blockingConsents.map(req => req.consentType)
      };
    } catch (error) {
      this.logger.error(
        `Error checking blocking consents: ${error.message}`,
        error.stack
      );
      return { blocked: false, missingConsents: [] };
    }
  }
}

