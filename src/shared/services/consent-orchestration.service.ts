import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { v4 as uuidv4 } from 'uuid';
import { publish } from 'ett-events-lib';
const QRCode = require('qrcode');

import { ConsentRequirement, ConsentRequestTiming, ConsentRequestMethod } from '../model/consent-requirement.entity';
import { ConsentRequirementVersion } from '../model/consent-requirement-version.entity';
import {
  ConsentRequest,
  ConsentRequestStatus,
} from '../model/consent-request.entity';
import { LgpdConsent, ConsentType, ConsentStatus } from '../model/lgpd-consent.entity';
import { LgpdConsentService } from './lgpd-consent.service';
import ConsentRequestCreated from '../events/ConsentRequestCreated';
import ConsentRequestCompleted from '../events/ConsentRequestCompleted';
import ConsentRequirementCreated from '../events/ConsentRequirementCreated';
import ConsentRequirementUpdated from '../events/ConsentRequirementUpdated';
import ConsentRequirementDeleted from '../events/ConsentRequirementDeleted';
import ConsentRequirementVersionCreated from '../events/ConsentRequirementVersionCreated';
import { ClientService } from '../../client/client.service';
import { CommerceService } from '../../commerce/commerce.service';
import { NotificationService } from '../../notification/notification.service';
import { NotificationType } from '../../notification/model/notification-type.enum';
import { NotificationChannel } from '../../notification/model/notification-channel.enum';
import { AuditLogService } from './audit-log.service';
import { FeatureToggleService } from '../../feature-toggle/feature-toggle.service';
import { FeatureToggle } from '../../feature-toggle/model/feature-toggle.entity';
import { FeatureToggleName } from '../../feature-toggle/model/feature-toggle.enum';
import { ConsentValidationService } from './consent-validation.service';
import { getLgpdConsentRequestWhatsappMessage } from '../messages/lgpd-messages';

/**
 * Servicio de orquestación de consentimientos LGPD
 * Centraliza la lógica de cuándo y cómo solicitar consentimientos
 */
@Injectable()
export class ConsentOrchestrationService {
  private readonly logger = new Logger(ConsentOrchestrationService.name);
  // Simple in-memory cache for requirements (TTL: 5 minutes)
  private requirementsCache: Map<string, { data: ConsentRequirement[]; expiresAt: number }> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes in milliseconds

  constructor(
    @InjectRepository(ConsentRequirement)
    private requirementRepository = getRepository(ConsentRequirement),
    @InjectRepository(ConsentRequest)
    private requestRepository = getRepository(ConsentRequest),
    @InjectRepository(ConsentRequirementVersion)
    private versionRepository = getRepository(ConsentRequirementVersion),
    @Inject(forwardRef(() => LgpdConsentService))
    private lgpdConsentService: LgpdConsentService,
    @Inject(forwardRef(() => ClientService))
    private clientService: ClientService,
    @Inject(forwardRef(() => CommerceService))
    private commerceService: CommerceService,
    @Inject(forwardRef(() => ConsentValidationService))
    private validationService: ConsentValidationService,
    @Optional() @Inject(forwardRef(() => NotificationService))
    private notificationService?: NotificationService,
    @Optional() @Inject(AuditLogService)
    private auditLogService?: AuditLogService,
    @Optional() @Inject(forwardRef(() => FeatureToggleService))
    private featureToggleService?: FeatureToggleService
  ) {}

  /**
   * Obtiene los requisitos de consentimiento activos para un comercio
   * Con cache en memoria para mejorar performance
   */
  async getRequirementsByCommerce(commerceId: string): Promise<ConsentRequirement[]> {
    try {
      const cacheKey = `consent-requirements:${commerceId}`;
      const now = Date.now();

      // Verificar cache
      const cached = this.requirementsCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        this.logger.debug(`Cache hit for requirements: ${commerceId}`);
        return cached.data;
      }

      // Si no está en cache o expiró, obtener de la base de datos
      const requirements = await this.requirementRepository
        .whereEqualTo('commerceId', commerceId)
        .whereEqualTo('active', true)
        .whereEqualTo('available', true)
        .find();

      // Guardar en cache
      if (requirements.length > 0) {
        this.requirementsCache.set(cacheKey, {
          data: requirements,
          expiresAt: now + this.CACHE_TTL,
        });
        this.logger.debug(`Cached requirements for commerce: ${commerceId}`);
      }

      return requirements;
    } catch (error) {
      this.logger.error(`Error getting requirements: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Invalida el cache de requisitos para un comercio
   * Debe llamarse cuando se crea, actualiza o elimina un requisito
   */
  private invalidateRequirementsCache(commerceId: string): void {
    const cacheKey = `consent-requirements:${commerceId}`;
    this.requirementsCache.delete(cacheKey);
    this.logger.debug(`Invalidated cache for requirements: ${commerceId}`);
  }

  /**
   * Crea un nuevo requisito de consentimiento
   */
  async createRequirement(
    commerceId: string,
    requirement: Partial<ConsentRequirement>,
    createdBy: string
  ): Promise<ConsentRequirement> {
    try {
      const newRequirement = new ConsentRequirement();
      Object.assign(newRequirement, requirement);
      newRequirement.commerceId = commerceId;
      newRequirement.active = requirement.active !== undefined ? requirement.active : true;
      newRequirement.available = requirement.available !== undefined ? requirement.available : true;
      newRequirement.createdAt = new Date();
      newRequirement.createdBy = createdBy;
      newRequirement.updatedAt = new Date();
      newRequirement.updatedBy = createdBy;

      // Validar que requestStrategy tenga valores por defecto
      if (!newRequirement.requestStrategy) {
        newRequirement.requestStrategy = {
          timing: ConsentRequestTiming.CHECK_IN,
          methods: [ConsentRequestMethod.WHATSAPP],
          reminderIntervalHours: 24,
          maxReminders: 3,
        };
      }

      // Validar que templates tenga valores por defecto
      if (!newRequirement.templates) {
        newRequirement.templates = {
          email: '',
          whatsapp: '',
          formIntroText: '',
          fullTerms: '',
          dataDescription: '',
          legalBasis: '',
          retentionPeriod: '',
          privacyPolicyLink: '',
          revocationInstructions: '',
        };
      }

      // Validar requisito antes de criar
      this.validationService.validateRequirement(newRequirement);

      // Validar compliance LGPD - lançar exceção se não estiver compliant
      const compliance = this.validationService.validateLgpdCompliance(newRequirement);
      if (!compliance.compliant) {
        const errorMessage = `Requisito não está em conformidade com LGPD: ${compliance.issues.join(', ')}. ${compliance.warnings.length > 0 ? `Avisos: ${compliance.warnings.join(', ')}` : ''}`;
        this.logger.error(errorMessage);
        throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
      }

      // Log warnings se houver
      if (compliance.warnings.length > 0) {
        this.logger.warn(
          `Requisito criado com avisos de compliance: ${compliance.warnings.join(', ')}`
        );
      }

      // Validar métodos para o timing
      for (const method of newRequirement.requestStrategy.methods) {
        const methodValidation = this.validationService.validateMethodForTiming(
          method,
          newRequirement.requestStrategy.timing
        );
        if (!methodValidation.valid) {
          this.logger.warn(
            `Método ${method} pode não ser apropriado para timing ${newRequirement.requestStrategy.timing}: ${methodValidation.reason}`
          );
        }
      }

      const created = await this.requirementRepository.create(newRequirement);

      // Publicar evento
      const event = new ConsentRequirementCreated(new Date(), {
        id: created.id,
        commerceId: created.commerceId,
        consentType: created.consentType,
        required: created.required,
        blockingForAttention: created.blockingForAttention,
        requestStrategy: created.requestStrategy,
        active: created.active,
      }, { user: createdBy });
      publish(event);

      // Registrar auditoría
      if (this.auditLogService) {
        await this.auditLogService.logAction(
          createdBy,
          'CREATE',
          'consent_requirement',
          created.id,
          {
            entityName: `Requisito de Consentimiento LGPD`,
            result: 'SUCCESS',
            commerceId: created.commerceId,
            complianceFlags: {
              lgpdConsent: true,
            },
            metadata: {
              consentType: created.consentType,
              required: created.required,
            },
          }
        );
      }

      // Criar versão inicial
      await this.createVersion(created, 'CREATE', createdBy).catch(err => {
        this.logger.warn(`Error creating version for requirement ${created.id}: ${err.message}`);
      });

      // Invalidar cache
      this.invalidateRequirementsCache(commerceId);

      return created;
    } catch (error) {
      this.logger.error(`Error creating requirement: ${error.message}`, error.stack);
      throw new HttpException(
        `Error al crear requisito: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Actualiza un requisito de consentimiento
   */
  async updateRequirement(
    requirementId: string,
    requirement: Partial<ConsentRequirement>,
    updatedBy: string
  ): Promise<ConsentRequirement> {
    try {
      const existing = await this.requirementRepository.findById(requirementId);
      if (!existing) {
        throw new HttpException('Requisito no encontrado', HttpStatus.NOT_FOUND);
      }

      Object.assign(existing, requirement);
      existing.updatedAt = new Date();
      existing.updatedBy = updatedBy;

      // Validar atualizações
      this.validationService.validateRequirement(existing);

      // Validar compliance LGPD - lançar exceção se não estiver compliant
      const compliance = this.validationService.validateLgpdCompliance(existing);
      if (!compliance.compliant) {
        const errorMessage = `Requisito não está em conformidade com LGPD: ${compliance.issues.join(', ')}. ${compliance.warnings.length > 0 ? `Avisos: ${compliance.warnings.join(', ')}` : ''}`;
        this.logger.error(errorMessage);
        throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
      }

      // Log warnings se houver
      if (compliance.warnings.length > 0) {
        this.logger.warn(
          `Requisito atualizado com avisos de compliance: ${compliance.warnings.join(', ')}`
        );
      }

      const updated = await this.requirementRepository.update(existing);

      // Publicar evento
      const event = new ConsentRequirementUpdated(new Date(), {
        id: updated.id,
        commerceId: updated.commerceId,
        consentType: updated.consentType,
        required: updated.required,
        blockingForAttention: updated.blockingForAttention,
        requestStrategy: updated.requestStrategy,
        active: updated.active,
      }, { user: updatedBy });
      publish(event);

      // Registrar auditoría
      if (this.auditLogService) {
        await this.auditLogService.logAction(
          updatedBy,
          'UPDATE',
          'consent_requirement',
          updated.id,
          {
            entityName: `Requisito de Consentimiento LGPD`,
            result: 'SUCCESS',
            commerceId: updated.commerceId,
            complianceFlags: {
              lgpdConsent: true,
            },
            metadata: {
              consentType: updated.consentType,
            },
          }
        );
      }

      // Invalidar cache
      this.invalidateRequirementsCache(existing.commerceId);

      return updated;
    } catch (error) {
      this.logger.error(`Error updating requirement: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Error al actualizar requisito: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Elimina un requisito de consentimiento (soft delete)
   */
  async deleteRequirement(requirementId: string, deletedBy: string): Promise<void> {
    try {
      const existing = await this.requirementRepository.findById(requirementId);
      if (!existing) {
        throw new HttpException('Requisito no encontrado', HttpStatus.NOT_FOUND);
      }

      // Validar se pode ser deletado
      const deletionValidation = this.validationService.validateRequirementDeletion(existing);
      if (!deletionValidation.canDelete) {
        throw new HttpException(
          deletionValidation.reason || 'Requisito não pode ser deletado',
          HttpStatus.BAD_REQUEST
        );
      }

      if (deletionValidation.warnings && deletionValidation.warnings.length > 0) {
        this.logger.warn(
          `Avisos ao deletar requisito: ${deletionValidation.warnings.join(', ')}`
        );
      }

      existing.active = false;
      existing.available = false;
      existing.updatedAt = new Date();
      existing.updatedBy = deletedBy;

      await this.requirementRepository.update(existing);

      // Publicar evento
      const event = new ConsentRequirementDeleted(new Date(), {
        id: existing.id,
        commerceId: existing.commerceId,
        consentType: existing.consentType,
      }, { user: deletedBy });
      publish(event);

      // Registrar auditoría
      if (this.auditLogService) {
        await this.auditLogService.logAction(
          deletedBy,
          'DELETE',
          'consent_requirement',
          existing.id,
          {
            entityName: `Requisito de Consentimiento LGPD`,
            result: 'SUCCESS',
            commerceId: existing.commerceId,
            complianceFlags: {
              lgpdConsent: true,
            },
            metadata: {
              consentType: existing.consentType,
            },
          }
        );
      }

      // Invalidar cache
      this.invalidateRequirementsCache(existing.commerceId);
    } catch (error) {
      this.logger.error(`Error deleting requirement: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Error al eliminar requisito: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Determina qué consentimientos faltan para un cliente
   */
  async getMissingConsents(
    commerceId: string,
    clientId: string
  ): Promise<ConsentRequirement[]> {
    try {
      // 1. Obtener requisitos de la clínica
      const requirements = await this.getRequirementsByCommerce(commerceId);
      if (requirements.length === 0) {
        return [];
      }

      // 2. Obtener consentimientos ya otorgados
      const existingConsents = await this.lgpdConsentService.getConsentsByClient(
        commerceId,
        clientId,
        true
      ); // active only

      // 3. Calcular diferencia
      const missing = requirements.filter(req => {
        const hasConsent = existingConsents.some(
          c =>
            c.consentType === req.consentType &&
            c.status === ConsentStatus.GRANTED &&
            (!c.expiresAt || new Date(c.expiresAt) > new Date())
        );
        return !hasConsent;
      });

      return missing;
    } catch (error) {
      this.logger.error(`Error getting missing consents: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Solicita todos los consentimientos pendientes
   */
  async requestAllPendingConsents(
    commerceId: string,
    clientId: string,
    timing: ConsentRequestTiming,
    requestedBy: string
  ): Promise<ConsentRequest | null> {
    try {
      const missing = await this.getMissingConsents(commerceId, clientId);

      // Filtrar por timing apropiado
      const toRequest = missing.filter(
        m => m.requestStrategy.timing === timing
      );

      if (toRequest.length === 0) {
        return null;
      }

      // Verificar si ya existe una solicitud pendiente
      const existingRequest = await this.requestRepository
        .whereEqualTo('commerceId', commerceId)
        .whereEqualTo('clientId', clientId)
        .whereEqualTo('status', ConsentRequestStatus.PENDING)
        .whereGreaterThan('expiresAt', new Date())
        .find();

      if (existingRequest.length > 0) {
        // Actualizar solicitud existente con nuevos consentimientos
        const request = existingRequest[0];
        const newConsents = toRequest
          .map(t => t.consentType)
          .filter(
            ct => !request.requestedConsents.includes(ct)
          );
        if (newConsents.length > 0) {
          request.requestedConsents = [
            ...request.requestedConsents,
            ...newConsents,
          ];
          request.updatedAt = new Date();
          request.updatedBy = requestedBy;
          await this.requestRepository.update(request);
          // Reenviar notificaciones
          await this.sendConsentRequest(request, toRequest);
        }
        return request;
      }

      // Crear un único token para todos los consentimientos
      const token = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 72); // 72h validity

      // Crear registro de solicitud
      const request = new ConsentRequest();
      request.commerceId = commerceId;
      request.clientId = clientId;
      request.token = token;
      request.expiresAt = expiresAt;
      request.requestedConsents = toRequest.map(t => t.consentType);
      request.status = ConsentRequestStatus.PENDING;
      request.requestedAt = new Date();
      request.requestedBy = requestedBy;
      request.remindersSent = 0;
      request.active = true;
      request.available = true;
      request.createdAt = new Date();
      request.createdBy = requestedBy;

      const createdRequest = await this.requestRepository.create(request);

      // Publicar evento
      const event = new ConsentRequestCreated(new Date(), {
        id: createdRequest.id,
        requestId: createdRequest.id,
        clientId: createdRequest.clientId,
        commerceId: createdRequest.commerceId,
        token: createdRequest.token,
        requestedConsents: createdRequest.requestedConsents,
      }, { user: requestedBy });
      publish(event);

      // Registrar auditoría
      if (this.auditLogService) {
        await this.auditLogService.logAction(
          requestedBy,
          'CREATE',
          'consent_request',
          createdRequest.id,
          {
            entityName: `Solicitud de Consentimientos LGPD`,
            result: 'SUCCESS',
            commerceId: createdRequest.commerceId,
            complianceFlags: {
              lgpdConsent: true,
            },
            metadata: {
              clientId: createdRequest.clientId,
              consentTypes: createdRequest.requestedConsents,
              token: createdRequest.token,
              timing,
            },
          }
        );
      }

      // Enviar notificaciones
      await this.sendConsentRequest(createdRequest, toRequest);

      return createdRequest;
    } catch (error) {
      this.logger.error(
        `Error requesting pending consents: ${error.message}`,
        error.stack
      );
      throw new HttpException(
        `Error al solicitar consentimientos: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Envía la solicitud por los canales configurados
   */
  private async sendConsentRequest(
    request: ConsentRequest,
    requirements: ConsentRequirement[]
  ): Promise<void> {
    try {
      const client = await this.clientService.getClientById(request.clientId);
      const commerce = await this.commerceService.getCommerceById(request.commerceId);

      if (!client || !commerce) {
        this.logger.warn(
          `Client or commerce not found for request ${request.id}`
        );
        return;
      }

      const frontendUrl =
        process.env.FRONTEND_URL || process.env.BACKEND_URL || 'http://localhost:5173';
      const link = `${frontendUrl}/consent/${request.token}`;

      // Determinar métodos a usar (unión de todos los métodos configurados)
      const methods = new Set<ConsentRequestMethod>();
      requirements.forEach(req => {
        req.requestStrategy.methods.forEach(m => methods.add(m));
      });

      // Obtener feature toggles para este comercio
      let emailFeatureToggle: FeatureToggle[] = [];
      let whatsappFeatureToggle: FeatureToggle[] = [];
      let smsFeatureToggle: FeatureToggle[] = [];
      if (this.featureToggleService) {
        try {
          emailFeatureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(
            request.commerceId,
            FeatureToggleName.EMAIL
          );
          whatsappFeatureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(
            request.commerceId,
            FeatureToggleName.WHATSAPP
          );
          smsFeatureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(
            request.commerceId,
            FeatureToggleName.SMS
          );
        } catch (error) {
          this.logger.warn(`Error getting feature toggles: ${error.message}`);
        }
      }

      // Email
      if (
        client.email &&
        methods.has(ConsentRequestMethod.EMAIL) &&
        this.notificationService &&
        this.featureToggleIsActive(emailFeatureToggle, 'email-consent-request')
      ) {
        try {
          const emailMessage = this.buildEmailMessage(commerce, link, requirements);
          await this.notificationService.createEmailNotification(
            client.email,
            request.clientId,
            NotificationType.CONSENT_REQUEST,
            undefined, // attentionId
            request.commerceId,
            undefined, // queueId
            emailMessage,
            undefined, // attentionNumber
            commerce.name,
            link,
            commerce.logo || '',
            undefined, // moduleNumber
            undefined // collaboratorName
          );
          this.logger.log(`Consent request email sent to ${client.email}`);
        } catch (error) {
          this.logger.error(`Error sending consent email: ${error.message}`);
        }
      }

      // WhatsApp
      if (
        client.phone &&
        methods.has(ConsentRequestMethod.WHATSAPP) &&
        this.notificationService &&
        this.featureToggleIsActive(whatsappFeatureToggle, 'whatsapp-consent-request')
      ) {
        try {
          const whatsappMessage = this.buildWhatsAppMessage(commerce, link, requirements);
          // Usar número del comercio solo si la conexión está activa, sino usar default
          const servicePhoneNumber = (commerce.whatsappConnection?.connected && commerce.whatsappConnection?.whatsapp)
            ? commerce.whatsappConnection.whatsapp
            : process.env.WHATSGW_PHONE_NUMBER;
          await this.notificationService.createWhatsappNotification(
            client.phone,
            request.clientId,
            whatsappMessage,
            NotificationType.CONSENT_REQUEST,
            undefined, // attentionId
            request.commerceId,
            undefined, // queueId
            servicePhoneNumber
          );
          this.logger.log(`Consent request WhatsApp sent to ${client.phone}`);
        } catch (error) {
          this.logger.error(`Error sending consent WhatsApp: ${error.message}`);
        }
      }

      // SMS
      if (
        client.phone &&
        methods.has(ConsentRequestMethod.SMS) &&
        this.notificationService &&
        this.featureToggleIsActive(smsFeatureToggle, 'sms-consent-request')
      ) {
        try {
          const smsMessage = this.buildSmsMessage(commerce, link, requirements);
          await this.sendSmsConsentRequest(client.phone, request.clientId, smsMessage, request.commerceId);
          this.logger.log(`Consent request SMS sent to ${client.phone}`);
        } catch (error) {
          this.logger.error(`Error sending consent SMS: ${error.message}`);
        }
      }

      // Push Notification
      if (
        methods.has(ConsentRequestMethod.PUSH_NOTIFICATION) &&
        this.notificationService
      ) {
        try {
          const pushMessage = this.buildPushNotificationMessage(commerce, link, requirements);
          await this.sendPushConsentRequest(request.clientId, pushMessage, request.commerceId, link);
          this.logger.log(`Consent request Push Notification sent to ${request.clientId}`);
        } catch (error) {
          this.logger.error(`Error sending consent Push Notification: ${error.message}`);
        }
      }

      // In-App Notification
      if (
        methods.has(ConsentRequestMethod.IN_APP) &&
        this.notificationService
      ) {
        try {
          const inAppMessage = this.buildInAppMessage(commerce, link, requirements);
          await this.sendInAppConsentRequest(request.clientId, inAppMessage, request.commerceId, link);
          this.logger.log(`Consent request In-App sent to ${request.clientId}`);
        } catch (error) {
          this.logger.error(`Error sending consent In-App: ${error.message}`);
        }
      }

      // QR Code
      if (methods.has(ConsentRequestMethod.QR_CODE)) {
        try {
          const qrCodeData = await this.generateConsentQRCode(request.token, link, commerce);
          // Armazenar QR code no request para uso posterior
          request.qrCodeBase64 = qrCodeData.qrCodeBase64;
          request.qrCodeGeneratedAt = new Date();
          await this.requestRepository.update(request);
          this.logger.log(`Consent QR Code generated and stored for request ${request.id}`);
          // Nota: QR Code geralmente é usado presencialmente, então não enviamos automaticamente
          // Mas podemos armazenar o QR code data para uso posterior
        } catch (error) {
          this.logger.error(`Error generating consent QR Code: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error sending consent request: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Construye mensaje de email
   */
  private buildEmailMessage(
    commerce: any,
    link: string,
    requirements: ConsentRequirement[]
  ): string {
    const consentTypes = requirements.map(r => r.consentType).join(', ');
    return `
      <h2>${commerce.name} - Solicitud de Consentimientos LGPD</h2>
      <p>Estimado/a cliente,</p>
      <p>Necesitamos su consentimiento para los siguientes tratamientos de datos:</p>
      <ul>
        ${requirements.map(r => `<li>${r.consentType}</li>`).join('')}
      </ul>
      <p>Por favor, complete el formulario haciendo clic en el siguiente enlace:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Este enlace expirará en 72 horas.</p>
      <p>Gracias por su atención.</p>
    `;
  }

  /**
   * Construye mensaje de WhatsApp usando el template configurado
   */
  private buildWhatsAppMessage(
    commerce: any,
    link: string,
    requirements: ConsentRequirement[]
  ): string {
    // Intentar usar el template de WhatsApp del primer requirement que tenga template configurado
    let template = '';
    for (const req of requirements) {
      if (req.templates?.whatsapp && req.templates.whatsapp.trim()) {
        template = req.templates.whatsapp;
        break; // Usar el primer template encontrado
      }
    }

    // Si no hay template configurado, usar uno por defecto
    if (!template) {
      const language = commerce?.localeInfo?.language || 'pt';
      const consentTypesArr = requirements.map(r => r.consentType);
      template = getLgpdConsentRequestWhatsappMessage(language, commerce?.name || '', link, consentTypesArr);
    } else {
      // Reemplazar variables en el template
      template = template
        .replace(/\{commerceName\}/g, commerce.name || '')
        .replace(/\{commerceAddress\}/g, commerce.address || commerce.localeInfo?.address || '')
        .replace(/\{commercePhone\}/g, commerce.phone || commerce.whatsappConnection?.whatsapp || '')
        .replace(/\{commerceEmail\}/g, commerce.email || '')
        .replace(/\{link\}/g, link)
        .replace(/\{consentLink\}/g, link)
        .replace(/\{consentTypes\}/g, requirements.map(r => r.consentType).join(', '))
        .replace(/\{consentCount\}/g, requirements.length.toString());
    }

    // Asegurar que el link esté incluido si no está en el template
    if (!template.includes(link)) {
      template += `\n\n${link}`;
    }

    return template;
  }

  /**
   * Verifica si un feature toggle está activo
   */
  private featureToggleIsActive(featureToggle: FeatureToggle[], name: string): boolean {
    if (!featureToggle || featureToggle.length === 0) {
      // Si no hay feature toggles configurados, permitir por defecto (backward compatibility)
      return true;
    }
    const feature = featureToggle.find(elem => elem.name === name);
    if (feature) {
      return feature.active === true;
    }
    // Si el feature toggle no existe, permitir por defecto (backward compatibility)
    return true;
  }

  /**
   * Construye mensaje de SMS (más corto que WhatsApp)
   */
  private buildSmsMessage(
    commerce: any,
    link: string,
    requirements: ConsentRequirement[]
  ): string {
    // SMS debe ser más corto (máximo 160 caracteres recomendado)
    const consentCount = requirements.length;
    const shortLink = link.length > 30 ? `${link.substring(0, 27)}...` : link;
    return `${commerce.name}: Precisa consentimento LGPD para ${consentCount} tratamento(s). Acesse: ${shortLink} (Expira em 72h)`;
  }

  /**
   * Envía SMS de solicitud de consentimiento
   */
  private async sendSmsConsentRequest(
    phone: string,
    userId: string,
    message: string,
    commerceId: string
  ): Promise<void> {
    if (this.notificationService) {
      try {
        await this.notificationService.createSmsNotification(
          phone,
          userId,
          message,
          NotificationType.CONSENT_REQUEST,
          commerceId
        );
        this.logger.log(`SMS consent request sent successfully to ${phone}`);
      } catch (error) {
        this.logger.error(`Error sending SMS consent request: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Construye mensaje para Push Notification
   */
  private buildPushNotificationMessage(
    commerce: any,
    link: string,
    requirements: ConsentRequirement[]
  ): string {
    const consentCount = requirements.length;
    return `Consentimento LGPD necessário: ${consentCount} tratamento(s) de dados pendente(s)`;
  }

  /**
   * Envía Push Notification de solicitud de consentimiento
   */
  private async sendPushConsentRequest(
    userId: string,
    message: string,
    commerceId: string,
    link: string
  ): Promise<void> {
    // TODO: Implementar cuando el sistema de push notifications esté disponible
    this.logger.log(`Push notification consent request prepared for user ${userId}: ${message}`);
    // Esto requerirá integración con servicio de push notifications (FCM, OneSignal, etc.)
  }

  /**
   * Construye mensaje para In-App Notification
   */
  private buildInAppMessage(
    commerce: any,
    link: string,
    requirements: ConsentRequirement[]
  ): string {
    const consentCount = requirements.length;
    return `Você tem ${consentCount} consentimento(s) LGPD pendente(s). Clique para visualizar.`;
  }

  /**
   * Envía In-App Notification de solicitud de consentimiento
   */
  private async sendInAppConsentRequest(
    userId: string,
    message: string,
    commerceId: string,
    link: string
  ): Promise<void> {
    // TODO: Implementar cuando el sistema de notificaciones in-app esté disponible
    this.logger.log(`In-app notification consent request prepared for user ${userId}: ${message}`);
    // Esto puede usar WebSockets o sistema de notificaciones in-app existente
  }

  /**
   * Genera QR Code para solicitud de consentimiento
   */
  private async generateConsentQRCode(
    token: string,
    link: string,
    commerce: any
  ): Promise<{ qrCodeData: string; qrCodeUrl: string; qrCodeBase64: string }> {
    try {
      // Generar QR Code como base64
      const qrCodeBase64 = await QRCode.toDataURL(link, {
        errorCorrectionLevel: 'H', // High error correction
        width: 300,
      });

      // Extrair apenas o base64 (remover o prefixo data:image/png;base64,)
      const base64Data = qrCodeBase64.split(',')[1];

      this.logger.log(`QR Code generated successfully for token ${token}`);

      return {
        qrCodeData: link,
        qrCodeUrl: qrCodeBase64, // Data URL completo para uso direto em <img>
        qrCodeBase64: base64Data, // Apenas base64 para armazenamento
      };
    } catch (error) {
      this.logger.error(`Error generating QR Code: ${error.message}`, error.stack);
      // Retornar link mesmo em caso de erro
      return {
        qrCodeData: link,
        qrCodeUrl: '',
        qrCodeBase64: '',
      };
    }
  }

  /**
   * Obtiene o genera el QR Code de una solicitud de consentimiento
   */
  async getRequestQRCode(requestId: string): Promise<{
    qrCodeUrl: string;
    qrCodeBase64: string;
    link: string;
  }> {
    try {
      const request = await this.requestRepository.findById(requestId);
      if (!request) {
        throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
      }

      const frontendUrl =
        process.env.FRONTEND_URL || process.env.BACKEND_URL || 'http://localhost:5173';
      const link = `${frontendUrl}/consent/${request.token}`;

      // Si ya existe el QR code, retornarlo
      if (request.qrCodeBase64) {
        return {
          qrCodeUrl: `data:image/png;base64,${request.qrCodeBase64}`,
          qrCodeBase64: request.qrCodeBase64,
          link,
        };
      }

      // Si no existe, generarlo
      const commerce = await this.commerceService.getCommerceById(request.commerceId);
      const qrCodeData = await this.generateConsentQRCode(request.token, link, commerce);

      // Guardar en el request
      request.qrCodeBase64 = qrCodeData.qrCodeBase64;
      request.qrCodeGeneratedAt = new Date();
      await this.requestRepository.update(request);

      return {
        qrCodeUrl: qrCodeData.qrCodeUrl,
        qrCodeBase64: qrCodeData.qrCodeBase64,
        link,
      };
    } catch (error) {
      this.logger.error(`Error getting request QR Code: ${error.message}`, error.stack);
      throw new HttpException(
        `Error getting QR Code: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Valida un token de consentimiento
   */
  async validateConsentToken(token: string): Promise<{
    valid: boolean;
    expired: boolean;
    request?: ConsentRequest;
    commerce?: any;
    client?: any;
    requirements?: ConsentRequirement[];
  }> {
    try {
      const request = await this.requestRepository
        .whereEqualTo('token', token)
        .whereEqualTo('active', true)
        .findOne();

      if (!request) {
        return { valid: false, expired: false };
      }

      const now = new Date();
      const expired = request.expiresAt < now;

      if (expired) {
        return { valid: false, expired: true, request };
      }

      // Marcar como visto si no estaba marcado
      if (!request.viewedAt) {
        request.viewedAt = new Date();
        request.updatedAt = new Date();
        await this.requestRepository.update(request);
      }

      // Cargar datos relacionados
      const commerce = await this.commerceService.getCommerceById(request.commerceId);
      const client = await this.clientService.getClientById(request.clientId);
      const requirements = await this.requirementRepository
        .whereEqualTo('commerceId', request.commerceId)
        .whereIn('consentType', request.requestedConsents)
        .whereEqualTo('active', true)
        .find();

      return {
        valid: true,
        expired: false,
        request,
        commerce,
        client,
        requirements,
      };
    } catch (error) {
      this.logger.error(`Error validating token: ${error.message}`, error.stack);
      return { valid: false, expired: false };
    }
  }

  /**
   * Procesa la respuesta del cliente desde el formulario web
   */
  async processConsentResponse(
    token: string,
    responses: Array<{ consentType: ConsentType; granted: boolean; notes?: string }>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ConsentRequest> {
    try {
      const validation = await this.validateConsentToken(token);
      if (!validation.valid || validation.expired || !validation.request) {
        throw new HttpException(
          'Token inválido ou expirado',
          HttpStatus.BAD_REQUEST
        );
      }

      const request = validation.request;
      const requirements = validation.requirements || [];

      // Crear/actualizar consentimientos
      for (const response of responses) {
        if (!request.requestedConsents.includes(response.consentType)) {
          continue; // Ignorar consentimientos no solicitados
        }

        // Buscar requirement correspondente para calcular expiração
        const requirement = requirements.find(req => req.consentType === response.consentType);
        let expiresAt: Date | undefined;

        if (requirement?.requestStrategy?.expiresInDays) {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + requirement.requestStrategy.expiresInDays);
        }

        const consentData = {
          clientId: request.clientId,
          commerceId: request.commerceId,
          consentType: response.consentType,
          status: response.granted ? ConsentStatus.GRANTED : ConsentStatus.DENIED,
          purpose: this.getPurposeForType(response.consentType),
          consentMethod: 'WEB' as const,
          ipAddress,
          userAgent,
          notes: response.notes,
          expiresAt: expiresAt,
          specificData: {
            requestToken: token,
            requestedAt: request.requestedAt,
          },
        };

        // Validar consentimento antes de criar/atualizar
        this.validationService.validateConsentGrant(consentData);

        await this.lgpdConsentService.createOrUpdateConsent(request.clientId, consentData);
      }

      // Actualizar request
      request.status = ConsentRequestStatus.COMPLETED;
      request.completedAt = new Date();
      request.ipAddress = ipAddress;
      request.userAgent = userAgent;
      request.updatedAt = new Date();
      const updated = await this.requestRepository.update(request);

      // Publicar evento
      const event = new ConsentRequestCompleted(new Date(), {
        id: updated.id,
        requestId: updated.id,
        clientId: updated.clientId,
        commerceId: updated.commerceId,
        status: updated.status,
      }, { user: request.clientId });
      publish(event);

      // Registrar auditoría
      if (this.auditLogService) {
        await this.auditLogService.logAction(
          request.clientId,
          'UPDATE',
          'consent_request',
          updated.id,
          {
            entityName: `Completado Consentimientos LGPD`,
            result: 'SUCCESS',
            commerceId: updated.commerceId,
            ipAddress,
            userAgent,
            complianceFlags: {
              lgpdConsent: true,
            },
            metadata: {
              status: updated.status,
              completedAt: updated.completedAt,
              responsesCount: responses.length,
            },
          }
        );
      }

      return updated;
    } catch (error) {
      this.logger.error(
        `Error processing consent response: ${error.message}`,
        error.stack
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Error al procesar respuesta: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtiene el propósito por defecto para un tipo de consentimiento
   */
  private getPurposeForType(consentType: ConsentType): string {
    const purposes = {
      [ConsentType.DATA_PROCESSING]: 'Processamento de dados pessoais para prestação de serviços',
      [ConsentType.DATA_SHARING]: 'Compartilhamento de dados com terceiros autorizados',
      [ConsentType.MARKETING]: 'Envio de comunicações de marketing',
      [ConsentType.RESEARCH]: 'Uso de dados para pesquisa científica',
      [ConsentType.THIRD_PARTY]: 'Compartilhamento com terceiros',
      [ConsentType.DATA_EXPORT]: 'Exportação de dados',
      [ConsentType.TELEMEDICINE]: 'Telemedicina e consultas remotas',
      [ConsentType.BIOMETRIC]: 'Processamento de dados biométricos',
      [ConsentType.TERMS_ACCEPTANCE]: 'Aceitação de termos e condições',
    };
    return purposes[consentType] || 'Tratamento de dados pessoais';
  }

  /**
   * Obtiene el estado consolidado de consentimientos para un cliente
   */
  async getConsentStatus(
    commerceId: string,
    clientId: string
  ): Promise<{
    clientId: string;
    commerceId: string;
    consents: LgpdConsent[];
    requirements: ConsentRequirement[];
    missing: ConsentRequirement[];
      summary: {
        total: number;
        granted: number;
        pending: number;
        denied: number;
        expired: number;
        revoked: number;
      };
  }> {
    try {
      const requirements = await this.getRequirementsByCommerce(commerceId);
      const consents = await this.lgpdConsentService.getConsentsByClient(
        commerceId,
        clientId,
        false
      ); // all consents
      const missing = await this.getMissingConsents(commerceId, clientId);

      const summary = {
        total: requirements.length,
        granted: consents.filter(c => c.status === ConsentStatus.GRANTED).length,
        pending: missing.length,
        denied: consents.filter(c => c.status === ConsentStatus.DENIED).length,
        expired: consents.filter(c => c.status === ConsentStatus.EXPIRED).length,
        revoked: consents.filter(c => c.status === ConsentStatus.REVOKED).length,
      };

      return {
        clientId,
        commerceId,
        consents,
        requirements,
        missing,
        summary,
      };
    } catch (error) {
      this.logger.error(`Error getting consent status: ${error.message}`, error.stack);
      throw new HttpException(
        `Error al obtener estado: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtiene métricas agregadas de compliance para un comercio
   */
  async getComplianceMetrics(
    commerceId: string,
    startDate?: string,
    endDate?: Date
  ): Promise<{
    totalClients: number;
    clientsWithAllConsents: number;
    clientsWithPendingConsents: number;
    clientsWithExpiredConsents: number;
    totalConsents: number;
    grantedConsents: number;
    pendingConsents: number;
    deniedConsents: number;
    expiredConsents: number;
    revokedConsents: number;
    complianceScore: number;
    blockingConsents: number;
  }> {
    try {
      const requirements = await this.getRequirementsByCommerce(commerceId);
      const activeRequirements = requirements.filter(req => req.active && req.available);

      // Obtener todos los consentimientos del comercio
      const allConsents = await this.lgpdConsentService.getAllConsents(
        { commerceId, startDate: startDate ? new Date(startDate) : undefined, endDate },
        10000
      );

      // Obtener clientes únicos
      const uniqueClientIds = new Set(allConsents.map(c => c.clientId));
      const totalClients = uniqueClientIds.size;

      // Calcular métricas por cliente
      let clientsWithAllConsents = 0;
      let clientsWithPendingConsents = 0;
      let clientsWithExpiredConsents = 0;
      let blockingConsents = 0;

      for (const clientId of uniqueClientIds) {
        const clientStatus = await this.getConsentStatus(commerceId, clientId);

        // Verificar si tiene todos los consentimientos requeridos
        const hasAllConsents = clientStatus.missing.length === 0;
        if (hasAllConsents) {
          clientsWithAllConsents++;
        }

        // Verificar si tiene pendientes
        if (clientStatus.summary.pending > 0) {
          clientsWithPendingConsents++;
        }

        // Verificar si tiene expirados
        if (clientStatus.summary.expired > 0) {
          clientsWithExpiredConsents++;
        }

        // Contar consentimientos bloqueantes faltantes
        const blockingMissing = clientStatus.missing.filter(
          req => req.blockingForAttention && req.required
        );
        if (blockingMissing.length > 0) {
          blockingConsents += blockingMissing.length;
        }
      }

      // Calcular métricas agregadas de consentimientos
      const totalConsents = allConsents.length;
      const grantedConsents = allConsents.filter(c => c.status === ConsentStatus.GRANTED).length;
      const pendingConsents = allConsents.filter(
        c => c.status === ConsentStatus.PENDING
      ).length;
      const deniedConsents = allConsents.filter(c => c.status === ConsentStatus.DENIED).length;
      const expiredConsents = allConsents.filter(c => c.status === ConsentStatus.EXPIRED).length;
      const revokedConsents = allConsents.filter(c => c.status === ConsentStatus.REVOKED).length;

      // Calcular compliance score (0-100)
      // Score = (clientes con todos los consentimientos / total clientes) * 100
      // Penalización por expirados y pendientes
      let complianceScore = 0;
      if (totalClients > 0) {
        const baseScore = (clientsWithAllConsents / totalClients) * 100;
        const expiredPenalty = (clientsWithExpiredConsents / totalClients) * 20; // Máximo 20 puntos de penalización
        const pendingPenalty = (clientsWithPendingConsents / totalClients) * 10; // Máximo 10 puntos de penalización
        complianceScore = Math.max(0, Math.min(100, baseScore - expiredPenalty - pendingPenalty));
      }

      return {
        totalClients,
        clientsWithAllConsents,
        clientsWithPendingConsents,
        clientsWithExpiredConsents,
        totalConsents,
        grantedConsents,
        pendingConsents,
        deniedConsents,
        expiredConsents,
        revokedConsents,
        complianceScore: Math.round(complianceScore),
        blockingConsents,
      };
    } catch (error) {
      this.logger.error(`Error getting compliance metrics: ${error.message}`, error.stack);
      throw new HttpException(
        `Error getting compliance metrics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtener métricas de notificaciones de consentimiento LGPD
   */
  async getNotificationMetrics(
    commerceId: string,
    startDate?: string,
    endDate?: Date
  ): Promise<{
    totalSent: number;
    byChannel: {
      email: number;
      whatsapp: number;
      sms: number;
      push: number;
      inApp: number;
    };
    byStatus: {
      sent: number;
      delivered: number;
      failed: number;
      pending: number;
    };
    successRate: number;
    dailyBreakdown: Array<{ date: string; count: number }>;
  }> {
    try {
      // TODO: Integrar con query-stack para obtener métricas reales de notificaciones
      // Por ahora, retornamos métricas basadas en los requests de consentimiento
      const requests = await this.requestRepository
        .whereEqualTo('commerceId', commerceId)
        .find();

      // Filtrar por fecha si se proporciona
      let filteredRequests = requests;
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate || new Date();
        filteredRequests = requests.filter(req => {
          const reqDate = req.createdAt ? new Date(req.createdAt) : new Date();
          if (start && reqDate < start) return false;
          if (end && reqDate > end) return false;
          return true;
        });
      }

      // Obtener requisitos para determinar métodos de notificación
      const requirements = await this.getRequirementsByCommerce(commerceId);
      const requirementsMap = new Map(requirements.map(r => [r.consentType, r]));

      // Contar por canal (basado en métodos de los requisitos asociados)
      const byChannel = {
        email: 0,
        whatsapp: 0,
        sms: 0,
        push: 0,
        inApp: 0,
      };

      filteredRequests.forEach(req => {
        req.requestedConsents?.forEach(consentType => {
          const requirement = requirementsMap.get(consentType);
          if (requirement?.requestStrategy?.methods) {
            if (requirement.requestStrategy.methods.includes(ConsentRequestMethod.EMAIL)) byChannel.email++;
            if (requirement.requestStrategy.methods.includes(ConsentRequestMethod.WHATSAPP)) byChannel.whatsapp++;
            if (requirement.requestStrategy.methods.includes(ConsentRequestMethod.SMS)) byChannel.sms++;
            if (requirement.requestStrategy.methods.includes(ConsentRequestMethod.PUSH_NOTIFICATION)) byChannel.push++;
            if (requirement.requestStrategy.methods.includes(ConsentRequestMethod.IN_APP)) byChannel.inApp++;
          }
        });
      });

      // Contar por estado (basado en status del request)
      const byStatus = {
        sent: filteredRequests.filter(r => r.status === ConsentRequestStatus.COMPLETED || r.status === ConsentRequestStatus.PARTIALLY_COMPLETED).length,
        delivered: filteredRequests.filter(r => r.viewedAt !== undefined).length,
        failed: filteredRequests.filter(r => r.status === ConsentRequestStatus.EXPIRED).length,
        pending: filteredRequests.filter(r => r.status === ConsentRequestStatus.PENDING).length,
      };

      const totalSent = filteredRequests.length;
      const successRate =
        totalSent > 0
          ? Math.round(
              ((byStatus.sent + byStatus.delivered) / totalSent) * 100
            )
          : 0;

      // Agrupar por día
      const dailyMap = new Map<string, number>();
      filteredRequests.forEach(req => {
        const date = req.createdAt
          ? new Date(req.createdAt).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
        dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
      });

      const dailyBreakdown = Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalSent,
        byChannel,
        byStatus,
        successRate,
        dailyBreakdown,
      };
    } catch (error) {
      this.logger.error(`Error getting notification metrics: ${error.message}`, error.stack);
      throw new HttpException(
        `Error getting notification metrics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Criar versão de um requisito
   */
  private async createVersion(
    requirement: ConsentRequirement,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    changedBy: string,
    changedFields?: string[]
  ): Promise<ConsentRequirementVersion> {
    try {
      // Obter próxima versão
      const existingVersions = await this.versionRepository
        .whereEqualTo('requirementId', requirement.id)
        .find();

      const nextVersion = existingVersions.length + 1;

      // Criar snapshot completo
      const snapshot: ConsentRequirement = {
        ...requirement,
      };

      const version = new ConsentRequirementVersion();
      version.id = `${requirement.id}-v${nextVersion}`;
      version.requirementId = requirement.id;
      version.commerceId = requirement.commerceId;
      version.version = nextVersion;
      version.snapshot = snapshot;
      version.action = action;
      version.changedBy = changedBy;
      version.changedAt = new Date();
      version.changedFields = changedFields;
      version.active = true;
      version.available = true;
      version.createdAt = new Date();

      const createdVersion = await this.versionRepository.create(version);

      // Publicar evento de versión creada
      try {
        const event = new ConsentRequirementVersionCreated(new Date(), {
          id: createdVersion.id,
          requirementId: requirement.id,
          commerceId: requirement.commerceId,
          version: nextVersion,
          action: action,
          changedBy: changedBy,
          changedAt: version.changedAt,
          changedFields: changedFields || [],
          snapshot: snapshot,
        }, { user: changedBy });
        publish(event);
        this.logger.log(`Version event published for requirement ${requirement.id}, version ${nextVersion}`);
      } catch (error) {
        this.logger.warn(`Error publishing version event: ${error.message}`);
        // No lanzar error para no romper el flujo principal
      }

      return createdVersion;
    } catch (error) {
      this.logger.error(`Error creating version: ${error.message}`, error.stack);
      // Não lançar erro para não quebrar o fluxo principal
      throw error;
    }
  }

  /**
   * Identificar campos alterados entre duas versões
   */
  private getChangedFields(
    existing: ConsentRequirement,
    updated: Partial<ConsentRequirement>
  ): string[] {
    const changedFields: string[] = [];

    // Verificar campos principais
    if (updated.consentType !== undefined && updated.consentType !== existing.consentType) {
      changedFields.push('consentType');
    }
    if (updated.required !== undefined && updated.required !== existing.required) {
      changedFields.push('required');
    }
    if (updated.blockingForAttention !== undefined && updated.blockingForAttention !== existing.blockingForAttention) {
      changedFields.push('blockingForAttention');
    }
    if (updated.active !== undefined && updated.active !== existing.active) {
      changedFields.push('active');
    }

    // Verificar requestStrategy
    if (updated.requestStrategy) {
      if (updated.requestStrategy.timing !== existing.requestStrategy?.timing) {
        changedFields.push('requestStrategy.timing');
      }
      if (JSON.stringify(updated.requestStrategy.methods) !== JSON.stringify(existing.requestStrategy?.methods)) {
        changedFields.push('requestStrategy.methods');
      }
      if (updated.requestStrategy.reminderIntervalHours !== existing.requestStrategy?.reminderIntervalHours) {
        changedFields.push('requestStrategy.reminderIntervalHours');
      }
      if (updated.requestStrategy.maxReminders !== existing.requestStrategy?.maxReminders) {
        changedFields.push('requestStrategy.maxReminders');
      }
    }

    // Verificar templates
    if (updated.templates) {
      const templateFields = [
        'whatsapp',
        'email',
        'formIntroText',
        'fullTerms',
        'dataDescription',
        'legalBasis',
        'retentionPeriod',
        'privacyPolicyLink',
        'revocationInstructions',
      ];

      templateFields.forEach(field => {
        if (updated.templates[field] !== undefined && updated.templates[field] !== existing.templates?.[field]) {
          changedFields.push(`templates.${field}`);
        }
      });
    }

    return changedFields;
  }

  /**
   * Obter histórico de versões de um requisito
   */
  async getRequirementVersions(requirementId: string): Promise<ConsentRequirementVersion[]> {
    try {
      const versions = await this.versionRepository
        .whereEqualTo('requirementId', requirementId)
        .whereEqualTo('active', true)
        .whereEqualTo('available', true)
        .find();

      // Ordenar por versão (mais recente primeiro)
      return versions.sort((a, b) => b.version - a.version);
    } catch (error) {
      this.logger.error(`Error getting versions: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Obter uma versão específica
   */
  async getRequirementVersion(requirementId: string, version: number): Promise<ConsentRequirementVersion | null> {
    try {
      const versions = await this.versionRepository
        .whereEqualTo('requirementId', requirementId)
        .whereEqualTo('version', version)
        .whereEqualTo('active', true)
        .whereEqualTo('available', true)
        .find();

      return versions.length > 0 ? versions[0] : null;
    } catch (error) {
      this.logger.error(`Error getting version: ${error.message}`, error.stack);
      return null;
    }
  }
}

