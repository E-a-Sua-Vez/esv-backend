import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

import { ClientService } from '../client/client.service';
import { Client } from '../client/model/client.entity';
import { CommerceService } from '../commerce/commerce.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/model/notification-type.enum';
import { GcpLoggerService } from '../shared/logger/gcp-logger.service';
import { ConsentOrchestrationService } from '../shared/services/consent-orchestration.service';
import { LgpdConsentService } from '../shared/services/lgpd-consent.service';
import { TelemedicineService } from '../telemedicine/telemedicine.service';
import { DocumentsService } from '../documents/documents.service';
import { AttentionService } from '../attention/attention.service';
import { DocumentType } from '../documents/model/document.enum';
import { Attention } from '../attention/model/attention.entity';

import { ClientPortalSession } from './model/client-portal-session.entity';

/**
 * Serviço de autenticação do portal do cliente
 * Gerencia acesso via código (similar a telemedicina)
 */
@Injectable()
export class ClientPortalService {
  private readonly logger = new Logger(ClientPortalService.name);

  constructor(
    @InjectRepository(ClientPortalSession)
    private sessionRepository = getRepository(ClientPortalSession),
    private clientService: ClientService,
    private commerceService: CommerceService,
    private notificationService: NotificationService,
    private readonly gcpLogger: GcpLoggerService,
    @Optional() @Inject(forwardRef(() => ConsentOrchestrationService))
    private consentOrchestrationService?: ConsentOrchestrationService,
    @Optional() @Inject(forwardRef(() => LgpdConsentService))
    private lgpdConsentService?: LgpdConsentService,
    @Optional() @Inject(forwardRef(() => TelemedicineService))
    private telemedicineService?: TelemedicineService,
    @Optional() @Inject(forwardRef(() => DocumentsService))
    private documentsService?: DocumentsService,
    @Optional() @Inject(forwardRef(() => AttentionService))
    private attentionService?: AttentionService
  ) {
    this.gcpLogger.setContext('ClientPortalService');
  }

  /**
   * Solicita código de acesso ao portal
   */
  async requestAccess(
    commerceId: string,
    email?: string,
    phone?: string,
    idNumber?: string
  ): Promise<{ code: string; expiresAt: Date; sentVia: 'EMAIL' | 'WHATSAPP' | 'SMS' }> {
    try {
      // Validar que pelo menos um identificador foi fornecido
      if (!email && !phone && !idNumber) {
        throw new HttpException(
          'Email, phone ou idNumber é obrigatório',
          HttpStatus.BAD_REQUEST
        );
      }

      // Obtener businessId del commerce
      const commerce = await this.commerceService.getCommerceById(commerceId);
      if (!commerce) {
        throw new HttpException('Comércio não encontrado', HttpStatus.NOT_FOUND);
      }
      const businessId = commerce.businessId;

      // Buscar cliente no comércio
      let client;
      if (idNumber) {
        const searchResult = await this.clientService.searchClient(commerceId, idNumber);
        if (searchResult && searchResult.id) {
          client = await this.clientService.getClientById(searchResult.id);
        }
      } else if (email) {
        // Buscar por email usando getClientByIdNumberOrEmail
        client = await this.clientService.getClientByIdNumberOrEmail(businessId, '', email);
      } else if (phone) {
        // Buscar por phone usando el repositorio
        const clientRepository = getRepository(Client);
        client = await clientRepository
          .whereEqualTo('businessId', businessId)
          .whereEqualTo('phone', phone)
          .findOne();
      }

      if (!client) {
        throw new HttpException('Cliente não encontrado', HttpStatus.NOT_FOUND);
      }

      // Verificar se já existe sessão ativa
      const existingSession = await this.findActiveSession(client.id, commerceId);
      if (existingSession && new Date(existingSession.expiresAt) > new Date()) {
        // Gerar novo código para sessão existente
        const code = this.generateAccessCode();
        const codeHash = this.hashAccessCode(code);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

        existingSession.accessCode = code;
        existingSession.accessCodeHash = codeHash;
        existingSession.accessCodeSent = false;
        existingSession.accessCodeValidated = false;
        existingSession.accessCodeExpiresAt = expiresAt;
        existingSession.accessCodeValidationAttempts = 0;
        existingSession.accessCodeLockedUntil = undefined;

        await this.sessionRepository.update(existingSession);

        // Enviar código
        const sentVia = await this.sendAccessCode(
          client,
          commerceId,
          code,
          email,
          phone
        );

        existingSession.accessCodeSent = true;
        existingSession.accessCodeSentAt = new Date();
        existingSession.validatedVia = sentVia;
        await this.sessionRepository.update(existingSession);

        return {
          code: code, // Retornar apenas para logs/debug, não enviar em produção
          expiresAt,
          sentVia,
        };
      }

      // Criar nova sessão
      const session = new ClientPortalSession();
      session.id = uuidv4();
      session.clientId = client.id;
      session.commerceId = commerceId;
      session.sessionToken = uuidv4();

      const code = this.generateAccessCode();
      session.accessCode = code;
      session.accessCodeHash = this.hashAccessCode(code);
      session.accessCodeSent = false;
      session.accessCodeValidated = false;
      session.accessCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
      session.accessCodeValidationAttempts = 0;

      session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
      session.lastAccessAt = new Date();

      session.active = true;
      session.available = true;
      session.createdAt = new Date();

      const created = await this.sessionRepository.create(session);

      // Enviar código
      const sentVia = await this.sendAccessCode(client, commerceId, code, email, phone);

      created.accessCodeSent = true;
      created.accessCodeSentAt = new Date();
      created.validatedVia = sentVia;
      await this.sessionRepository.update(created);

      this.logger.log(`Portal access code sent to client ${client.id} via ${sentVia}`);

      return {
        code: code, // Retornar apenas para logs/debug
        expiresAt: created.accessCodeExpiresAt,
        sentVia,
      };
    } catch (error) {
      this.logger.error(`Error requesting portal access: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Erro ao solicitar acesso: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Valida código de acesso e retorna sessão
   */
  async validateCode(
    code: string,
    commerceId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{
    valid: boolean;
    sessionToken?: string;
    expiresAt?: Date;
    client?: any;
    commerce?: any;
  }> {
    try {
      // Buscar sessão pendente por commerceId
      const sessions = await this.sessionRepository
        .whereEqualTo('commerceId', commerceId)
        .whereEqualTo('accessCodeValidated', false)
        .whereEqualTo('active', true)
        .find();

      // Encontrar sessão com código válido
      let validSession = null;
      for (const session of sessions) {
        // Verificar se código expirou
        if (new Date(session.accessCodeExpiresAt) < new Date()) {
          continue;
        }

        // Verificar se está bloqueado
        if (session.accessCodeLockedUntil && new Date(session.accessCodeLockedUntil) > new Date()) {
          continue;
        }

        // Verificar código
        const isValid = this.verifyAccessCode(code, session.accessCodeHash);
        if (isValid) {
          validSession = session;
          break;
        }
      }

      if (!validSession) {
        // Incrementar tentativas em todas as sessões do commerce (rate limiting)
        for (const session of sessions) {
          if (new Date(session.accessCodeExpiresAt) > new Date()) {
            const attempts = (session.accessCodeValidationAttempts || 0) + 1;
            session.accessCodeValidationAttempts = attempts;

            // Bloquear após 5 tentativas por 30 minutos
            if (attempts >= 5) {
              session.accessCodeLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
            }

            await this.sessionRepository.update(session);
          }
        }

        throw new HttpException('Código inválido ou expirado', HttpStatus.UNAUTHORIZED);
      }

      // Validar sessão
      validSession.accessCodeValidated = true;
      validSession.accessCodeValidatedAt = new Date();
      validSession.accessCodeValidationAttempts = 0;
      validSession.accessCodeLockedUntil = undefined;
      validSession.lastAccessAt = new Date();
      if (ipAddress) validSession.ipAddress = ipAddress;
      if (userAgent) validSession.userAgent = userAgent;
      await this.sessionRepository.update(validSession);

      // Buscar cliente e comércio
      const client = await this.clientService.getClientById(validSession.clientId);
      const commerce = await this.commerceService.getCommerceById(validSession.commerceId);

      this.logger.log(`Portal access validated for client ${validSession.clientId}`);

      return {
        valid: true,
        sessionToken: validSession.sessionToken,
        expiresAt: validSession.expiresAt,
        client: {
          id: client.id,
          name: client.name,
          lastName: client.lastName,
          email: client.email,
          phone: client.phone,
        },
        commerce: {
          id: commerce.id,
          name: commerce.name,
          tag: commerce.tag,
          logo: commerce.logo,
        },
      };
    } catch (error) {
      this.logger.error(`Error validating portal code: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Erro ao validar código: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Valida token de sessão
   */
  /**
   * Valida token de sessão e verifica timeout de inatividade
   * Timeout de inatividade: 30 minutos sem acesso
   */
  async validateSession(token: string): Promise<{
    valid: boolean;
    expired: boolean;
    session?: ClientPortalSession;
    client?: any;
    commerce?: any;
  }> {
    try {
      const session = await this.sessionRepository
        .whereEqualTo('sessionToken', token)
        .whereEqualTo('active', true)
        .findOne();

      if (!session) {
        return { valid: false, expired: false };
      }

      const now = new Date();
      const expired = new Date(session.expiresAt) < now;

      if (expired) {
        // Marcar sessão como inativa
        session.active = false;
        await this.sessionRepository.update(session);
        return { valid: false, expired: true };
      }

      // Verificar timeout de inatividade (30 minutos)
      const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos
      const lastAccess = session.lastAccessAt ? new Date(session.lastAccessAt) : session.createdAt;
      const inactivityTimeout = new Date(lastAccess.getTime() + INACTIVITY_TIMEOUT_MS);

      if (now > inactivityTimeout) {
        // Sessão expirada por inatividade
        session.active = false;
        await this.sessionRepository.update(session);
        this.logger.log(`Session ${session.id} expired due to inactivity`);
        return { valid: false, expired: true };
      }

      // Atualizar último acesso
      session.lastAccessAt = now;
      await this.sessionRepository.update(session);

      // Buscar cliente e comércio
      const client = await this.clientService.getClientById(session.clientId);
      const commerce = await this.commerceService.getCommerceById(session.commerceId);

      return {
        valid: true,
        expired: false,
        session,
        client: {
          id: client.id,
          name: client.name,
          lastName: client.lastName,
          email: client.email,
          phone: client.phone,
        },
        commerce: {
          id: commerce.id,
          name: commerce.name,
          tag: commerce.tag,
          logo: commerce.logo,
        },
      };
    } catch (error) {
      this.logger.error(`Error validating session: ${error.message}`, error.stack);
      return { valid: false, expired: false };
    }
  }

  /**
   * Renova sessão
   */
  async renewSession(token: string): Promise<{ newToken: string; expiresAt: Date }> {
    try {
      const session = await this.sessionRepository
        .whereEqualTo('sessionToken', token)
        .whereEqualTo('active', true)
        .findOne();

      if (!session) {
        throw new HttpException('Sessão não encontrada', HttpStatus.NOT_FOUND);
      }

      // Gerar novo token
      session.sessionToken = uuidv4();
      session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
      session.lastAccessAt = new Date();
      await this.sessionRepository.update(session);

      return {
        newToken: session.sessionToken,
        expiresAt: session.expiresAt,
      };
    } catch (error) {
      this.logger.error(`Error renewing session: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Erro ao renovar sessão: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Encontra sessão ativa para cliente
   */
  private async findActiveSession(
    clientId: string,
    commerceId: string
  ): Promise<ClientPortalSession | null> {
    try {
      const session = await this.sessionRepository
        .whereEqualTo('clientId', clientId)
        .whereEqualTo('commerceId', commerceId)
        .whereEqualTo('active', true)
        .findOne();

      if (session && new Date(session.expiresAt) > new Date()) {
        return session;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Envia código de acesso
   */
  private async sendAccessCode(
    client: any,
    commerceId: string,
    code: string,
    email?: string,
    phone?: string
  ): Promise<'EMAIL' | 'WHATSAPP' | 'SMS'> {
    const commerce = await this.commerceService.getCommerceById(commerceId);
    const frontendUrl = process.env.FRONTEND_URL || 'https://interno.estuturno.app';
    const portalUrl = `${frontendUrl}/portal/login`;

    // Prioridade: Email > WhatsApp > SMS
    if (email && client.email) {
      try {
        const subject = `Código de Acesso - Portal do Cliente`;
        const htmlMessage = `
          <html>
            <body>
              <h2>Olá ${client.name || 'Cliente'}!</h2>
              <p>Seu código de acesso ao Portal do Cliente é:</p>
              <h1 style="font-size: 2em; letter-spacing: 0.5em; color: #2563eb;">${code}</h1>
              <p>Acesse: <a href="${portalUrl}">${portalUrl}</a></p>
              <p><strong>Este código expira em 15 minutos.</strong></p>
              <p>Atenciosamente,<br>${commerce.name || 'Equipe'}</p>
            </body>
          </html>
        `;
        const textMessage = `Olá ${client.name || 'Cliente'}!\n\nSeu código de acesso ao Portal do Cliente é: ${code}\n\nAcesse: ${portalUrl}\n\nEste código expira em 15 minutos.\n\nAtenciosamente,\n${commerce.name || 'Equipe'}`;

        await this.notificationService.createBookingRawEmailNotification(
          NotificationType.OTHER,
          undefined, // bookingId (not used for portal)
          commerceId,
          process.env.EMAIL_SOURCE || 'noreply@estuturno.app',
          [client.email],
          subject,
          [], // attachments
          htmlMessage
        );
        return 'EMAIL';
      } catch (error) {
        this.logger.warn(`Failed to send email code: ${error.message}`);
      }
    }

    if (phone && client.phone) {
      try {
        const message = `Olá ${client.name || 'Cliente'}! Seu código de acesso ao Portal é: ${code}. Acesse: ${portalUrl}. Expira em 15min.`;

        // Tentar WhatsApp primeiro
        try {
          const servicePhoneNumber = commerce.whatsappConnection?.whatsapp || process.env.WHATSAPP_PHONE_NUMBER;
          await this.notificationService.createWhatsappNotification(
            client.phone,
            client.id,
            message,
            NotificationType.OTHER,
            undefined, // attentionId
            commerceId,
            undefined, // queueId
            servicePhoneNumber
          );
          return 'WHATSAPP';
        } catch (error) {
          this.logger.warn(`Failed to send WhatsApp code: ${error.message}`);
        }

        // Fallback para SMS
        try {
          await this.notificationService.createSmsNotification(
            client.phone,
            client.id,
            message,
            NotificationType.OTHER,
            commerceId
          );
          return 'SMS';
        } catch (error) {
          this.logger.warn(`Failed to send SMS code: ${error.message}`);
        }
      } catch (error) {
        this.logger.error(`Failed to send phone code: ${error.message}`);
      }
    }

    throw new HttpException(
      'Não foi possível enviar código. Verifique email ou telefone do cliente.',
      HttpStatus.BAD_REQUEST
    );
  }

  /**
   * Gera código de acesso (4-8 caracteres)
   */
  private generateAccessCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const bytes = crypto.randomBytes(4); // 4 bytes = 8 caracteres

    for (let i = 0; i < 8; i++) {
      result += chars[bytes[i % 4] % chars.length];
    }

    return result;
  }

  /**
   * Hash do código de acesso
   */
  private hashAccessCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Verifica código de acesso
   */
  private verifyAccessCode(providedCode: string, storedHash: string): boolean {
    const providedHash = this.hashAccessCode(providedCode);
    return providedHash === storedHash;
  }

  /**
   * Obtém consentimentos do cliente
   */
  async getClientConsents(commerceId: string, clientId: string): Promise<any> {
    try {
      if (!this.consentOrchestrationService) {
        this.logger.warn('ConsentOrchestrationService not available');
        return {
          consents: [],
          summary: {
            total: 0,
            granted: 0,
            denied: 0,
            pending: 0,
            expired: 0,
            revoked: 0,
          },
        };
      }

      const status = await this.consentOrchestrationService.getConsentStatus(commerceId, clientId);

      return {
        consents: status.consents || [],
        summary: status.summary || {
          total: 0,
          granted: 0,
          denied: 0,
          pending: 0,
          expired: 0,
          revoked: 0,
        },
      };
    } catch (error) {
      this.logger.error(`Error getting client consents: ${error.message}`, error.stack);
      throw new HttpException(
        `Erro ao buscar consentimentos: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Revoga um consentimento
   */
  async revokeConsent(consentId: string, clientId: string, reason?: string): Promise<any> {
    try {
      if (!this.lgpdConsentService) {
        this.logger.warn('LgpdConsentService not available');
        throw new HttpException(
          'Serviço de consentimento não disponível',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      // Revogar consentimento (usando 'client-portal' como userId)
      const revoked = await this.lgpdConsentService.revokeConsent(
        'client-portal',
        consentId,
        reason
      );

      this.logger.log(`Consent ${consentId} revoked by client ${clientId} via portal`);

      return {
        success: true,
        consent: revoked,
        message: 'Consentimento revogado com sucesso',
      };
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
   * Obtém sessões de telemedicina do cliente
   */
  async getClientTelemedicineSessions(
    commerceId: string,
    clientId: string
  ): Promise<any[]> {
    try {
      if (!this.telemedicineService) {
        this.logger.warn('TelemedicineService not available');
        return [];
      }

      const sessions = await this.telemedicineService.listSessions(commerceId, clientId);
      return sessions || [];
    } catch (error) {
      this.logger.error(
        `Error getting telemedicine sessions: ${error.message}`,
        error.stack
      );
      throw new HttpException(
        `Erro ao buscar sessões de telemedicina: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtém perfil completo do cliente
   */
  async getClientProfile(clientId: string): Promise<any> {
    try {
      const client = await this.clientService.getClientById(clientId);
      if (!client) {
        throw new HttpException('Cliente não encontrado', HttpStatus.NOT_FOUND);
      }
      return client;
    } catch (error) {
      this.logger.error(`Error getting client profile: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Erro ao buscar perfil do cliente: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtém documentos do cliente
   */
  async getClientDocuments(commerceId: string, clientId: string): Promise<any[]> {
    try {
      if (!this.documentsService) {
        this.logger.warn('DocumentsService not available');
        return [];
      }

      const documents = await this.documentsService.getDocumentsByCommerceIdAndClient(
        commerceId,
        clientId,
        DocumentType.CLIENT
      );
      return documents || [];
    } catch (error) {
      this.logger.error(`Error getting client documents: ${error.message}`, error.stack);
      throw new HttpException(
        `Erro ao buscar documentos: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtém histórico de atenciones do cliente
   */
  async getClientAttentions(commerceId: string, clientId: string): Promise<any[]> {
    try {
      if (!this.attentionService) {
        this.logger.warn('AttentionService not available');
        return [];
      }

      // Buscar atenciones por clientId y commerceId usando el repositorio
      const attentionRepository = getRepository(Attention);
      const attentions = await attentionRepository
        .whereEqualTo('clientId', clientId)
        .whereEqualTo('commerceId', commerceId)
        .orderByDescending('createdAt')
        .find();

      // Convertir a DTOs simplificados para el portal
      return (attentions || []).map(attention => ({
        id: attention.id,
        number: attention.number,
        status: attention.status,
        createdAt: attention.createdAt,
        endAt: attention.endAt,
        queueId: attention.queueId,
        duration: attention.duration,
        servicesDetails: attention.servicesDetails || [],
        comment: attention.comment,
        ratedAt: attention.ratedAt,
        cancelled: attention.cancelled,
        cancelledAt: attention.cancelledAt,
      }));
    } catch (error) {
      this.logger.error(`Error getting client attentions: ${error.message}`, error.stack);
      throw new HttpException(
        `Erro ao buscar histórico de atenções: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

