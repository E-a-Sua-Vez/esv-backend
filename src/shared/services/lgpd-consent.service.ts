import { Injectable, Logger, HttpException, HttpStatus, Inject, Optional } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';

import { LgpdConsent, ConsentType, ConsentStatus } from '../model/lgpd-consent.entity';
import { AuditLogService } from './audit-log.service';
import LgpdConsentCreated from '../events/LgpdConsentCreated';
import { LgpdNotificationService } from './lgpd-notification.service';

/**
 * Serviço de gestão de consentimentos LGPD
 * Conformidade: LGPD (Lei 13.709/2018)
 */
@Injectable()
export class LgpdConsentService {
  private readonly logger = new Logger(LgpdConsentService.name);

  constructor(
    @InjectRepository(LgpdConsent)
    private consentRepository = getRepository(LgpdConsent),
    @Optional() @Inject(AuditLogService) private auditLogService?: AuditLogService,
    @Optional() @Inject(LgpdNotificationService) private lgpdNotificationService?: LgpdNotificationService
  ) {}

  /**
   * Criar ou atualizar consentimento
   */
  async createOrUpdateConsent(
    user: string,
    consent: Partial<LgpdConsent>
  ): Promise<LgpdConsent> {
    try {
      // Verificar se já existe consentimento para este tipo e cliente
      const existing = await this.consentRepository
        .whereEqualTo('clientId', consent.clientId)
        .whereEqualTo('commerceId', consent.commerceId)
        .whereEqualTo('consentType', consent.consentType)
        .whereEqualTo('active', true)
        .find();

      let consentEntity: LgpdConsent;

      if (existing.length > 0) {
        // Atualizar consentimento existente
        consentEntity = existing[0];
        consentEntity.status = consent.status || consentEntity.status;
        consentEntity.purpose = consent.purpose || consentEntity.purpose;
        consentEntity.description = consent.description || consentEntity.description;
        consentEntity.legalBasis = consent.legalBasis || consentEntity.legalBasis;
        consentEntity.expiresAt = consent.expiresAt || consentEntity.expiresAt;
        consentEntity.updatedAt = new Date();
        consentEntity.updatedBy = user;

        // Se foi revogado, atualizar data de revogação
        if (consent.status === ConsentStatus.REVOKED) {
          consentEntity.revokedAt = new Date();
          consentEntity.revokedBy = user;

          // Notificar al titular sobre revocación
          if (this.lgpdNotificationService) {
            await this.lgpdNotificationService.notifyConsentRevoked(
              consentEntity.clientId,
              consentEntity.commerceId,
              consentEntity.consentType,
              consentEntity.purpose || '',
              consent.notes || ''
            );
          }
        }

        // Adicionar ao histórico
        if (!consentEntity.history) {
          consentEntity.history = [];
        }
        consentEntity.history.push({
          timestamp: new Date(),
          action: consent.status === ConsentStatus.REVOKED ? 'REVOKED' : 'UPDATED',
          performedBy: user,
          reason: consent.notes,
          ipAddress: consent.ipAddress,
        });

        consentEntity = await this.consentRepository.update(consentEntity);
      } else {
        // Criar novo consentimento
        consentEntity = new LgpdConsent();
        Object.assign(consentEntity, consent);
        consentEntity.grantedAt = new Date();
        consentEntity.grantedBy = user;
        consentEntity.status = consent.status || ConsentStatus.GRANTED;
        consentEntity.active = true;
        consentEntity.available = true;
        consentEntity.createdAt = new Date();
        consentEntity.createdBy = user;
        consentEntity.history = [
          {
            timestamp: new Date(),
            action: 'GRANTED',
            performedBy: user,
            ipAddress: consent.ipAddress,
          },
        ];

        consentEntity = await this.consentRepository.create(consentEntity);

        // Publicar evento
        const event = new LgpdConsentCreated(new Date(), {
          consentId: consentEntity.id,
          clientId: consentEntity.clientId,
          commerceId: consentEntity.commerceId,
          consentType: consentEntity.consentType,
          status: consentEntity.status,
        }, { user });
        publish(event);

        // Notificar al titular si el consentimiento fue otorgado
        if (this.lgpdNotificationService && consentEntity.status === ConsentStatus.GRANTED) {
          await this.lgpdNotificationService.notifyConsentGranted(
            consentEntity.clientId,
            consentEntity.commerceId,
            consentEntity.consentType,
            consentEntity.purpose || ''
          );
        }
      }

      // Registrar auditoria
      if (this.auditLogService) {
        await this.auditLogService.logAction(
          user,
          'CREATE',
          'lgpd_consent',
          consentEntity.id,
          {
            entityName: `Consentimento ${consentEntity.consentType}`,
            result: 'SUCCESS',
            complianceFlags: {
              lgpdConsent: true,
            },
            metadata: {
              consentType: consentEntity.consentType,
              status: consentEntity.status,
              clientId: consentEntity.clientId,
            },
          }
        );
      }

      return consentEntity;
    } catch (error) {
      this.logger.error(`Error creating/updating consent: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Revogar consentimento
   */
  async revokeConsent(
    user: string,
    consentId: string,
    reason?: string
  ): Promise<LgpdConsent> {
    try {
      const consent = await this.consentRepository.findById(consentId);
      if (!consent) {
        throw new HttpException('Consentimento não encontrado', HttpStatus.NOT_FOUND);
      }

      if (consent.status === ConsentStatus.REVOKED) {
        throw new HttpException('Consentimento já foi revogado', HttpStatus.BAD_REQUEST);
      }

      consent.status = ConsentStatus.REVOKED;
      consent.revokedAt = new Date();
      consent.revokedBy = user;
      consent.updatedAt = new Date();
      consent.updatedBy = user;

      // Adicionar ao histórico
      if (!consent.history) {
        consent.history = [];
      }
      consent.history.push({
        timestamp: new Date(),
        action: 'REVOKED',
        performedBy: user,
        reason,
      });

      const updated = await this.consentRepository.update(consent);

      // Registrar auditoria
      if (this.auditLogService) {
        await this.auditLogService.logAction(
          user,
          'UPDATE',
          'lgpd_consent',
          consent.id,
          {
            entityName: `Consentimento ${consent.consentType}`,
            result: 'SUCCESS',
            changes: [
              {
                field: 'status',
                oldValue: consent.status,
                newValue: ConsentStatus.REVOKED,
              },
            ],
            complianceFlags: {
              lgpdConsent: true,
            },
          }
        );
      }

      return updated;
    } catch (error) {
      this.logger.error(`Error revoking consent: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Erro ao revogar consentimento: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obter consentimentos de um cliente
   */
  async getConsentsByClient(
    commerceId: string,
    clientId: string,
    activeOnly: boolean = true
  ): Promise<LgpdConsent[]> {
    try {
      let query = this.consentRepository
        .whereEqualTo('commerceId', commerceId)
        .whereEqualTo('clientId', clientId);

      if (activeOnly) {
        query = query.whereEqualTo('active', true);
      }

      return await query.orderByDescending('grantedAt').find();
    } catch (error) {
      this.logger.error(`Error getting consents by client: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Verificar se cliente tem consentimento ativo para um tipo específico
   */
  async hasActiveConsent(
    commerceId: string,
    clientId: string,
    consentType: ConsentType
  ): Promise<boolean> {
    try {
      const consents = await this.consentRepository
        .whereEqualTo('commerceId', commerceId)
        .whereEqualTo('clientId', clientId)
        .whereEqualTo('consentType', consentType)
        .whereEqualTo('status', ConsentStatus.GRANTED)
        .whereEqualTo('active', true)
        .find();

      if (consents.length === 0) {
        return false;
      }

      // Verificar se não expirou
      const consent = consents[0];
      if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) {
        // Marcar como expirado
        consent.status = ConsentStatus.EXPIRED;
        await this.consentRepository.update(consent);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Error checking active consent: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Obter consentimento por ID
   */
  async getConsentById(id: string): Promise<LgpdConsent> {
    const consent = await this.consentRepository.findById(id);
    if (!consent) {
      throw new HttpException('Consentimento não encontrado', HttpStatus.NOT_FOUND);
    }
    return consent;
  }

  /**
   * Obter todos os consentimentos (para relatórios)
   */
  async getAllConsents(
    filters?: {
      commerceId?: string;
      clientId?: string;
      consentType?: ConsentType;
      status?: ConsentStatus;
      startDate?: Date;
      endDate?: Date;
    },
    limit: number = 1000
  ): Promise<LgpdConsent[]> {
    try {
      let query: any = this.consentRepository;

      if (filters?.commerceId) {
        query = query.whereEqualTo('commerceId', filters.commerceId);
      }
      if (filters?.clientId) {
        query = query.whereEqualTo('clientId', filters.clientId);
      }
      if (filters?.consentType) {
        query = query.whereEqualTo('consentType', filters.consentType);
      }
      if (filters?.status) {
        query = query.whereEqualTo('status', filters.status);
      }
      if (filters?.startDate) {
        query = query.whereGreaterOrEqualThan('grantedAt', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.whereLessOrEqualThan('grantedAt', filters.endDate);
      }

      return await query.orderByDescending('grantedAt').limit(limit).find();
    } catch (error) {
      this.logger.error(`Error getting all consents: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Verificar e atualizar consentimentos expirados
   */
  async checkExpiredConsents(): Promise<number> {
    try {
      const now = new Date();
      const expiredConsents = await this.consentRepository
        .whereEqualTo('status', ConsentStatus.GRANTED)
        .whereEqualTo('active', true)
        .whereLessThan('expiresAt', now)
        .find();

      let updated = 0;
      for (const consent of expiredConsents) {
        consent.status = ConsentStatus.EXPIRED;
        consent.updatedAt = new Date();
        await this.consentRepository.update(consent);
        updated++;
      }

      return updated;
    } catch (error) {
      this.logger.error(`Error checking expired consents: ${error.message}`, error.stack);
      return 0;
    }
  }
}

