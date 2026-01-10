import * as crypto from 'crypto';

import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Inject,
  Optional,
  forwardRef,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { v4 as uuidv4 } from 'uuid';

import { ClientService } from '../client/client.service';
import { CommerceService } from '../commerce/commerce.service';
import { NotificationType } from '../notification/model/notification-type.enum';
import { NotificationService } from '../notification/notification.service';
import { ClientPortalService } from '../client-portal/client-portal.service';
import { getTelemedicineAccessKeyEmail } from '../attention/notifications/notifications';

import { CreateTelemedicineSessionDto } from './dto/create-telemedicine-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import TelemedicineAccessKeySent from './events/TelemedicineAccessKeySent';
import TelemedicineAccessKeyValidated from './events/TelemedicineAccessKeyValidated';
import TelemedicineDoctorConnected from './events/TelemedicineDoctorConnected';
import TelemedicineMessageSent from './events/TelemedicineMessageSent';
import TelemedicinePatientConnected from './events/TelemedicinePatientConnected';
import TelemedicineSessionCancelled from './events/TelemedicineSessionCancelled';
import TelemedicineSessionCreated from './events/TelemedicineSessionCreated';
import TelemedicineSessionEnded from './events/TelemedicineSessionEnded';
import TelemedicineSessionStarted from './events/TelemedicineSessionStarted';
import { TelemedicineMessage, MessageSenderType } from './model/telemedicine-message.entity';
import {
  TelemedicineSession,
  TelemedicineSessionStatus,
  TelemedicineSessionType,
} from './model/telemedicine-session.entity';
import type { TelemedicineGateway } from './telemedicine.gateway';

@Injectable()
export class TelemedicineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemedicineService.name);
  private readonly s3: AWS.S3;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private timeoutCheckInterval: NodeJS.Timeout | null = null;

  // Configuration for session timeout (default: 1 hour of inactivity)
  private readonly SESSION_TIMEOUT_MS = parseInt(
    process.env.TELEMEDICINE_SESSION_TIMEOUT_MS || '3600000',
    10
  ); // 1 hour default
  private readonly CLEANUP_INTERVAL_MS = parseInt(
    process.env.TELEMEDICINE_CLEANUP_INTERVAL_MS || '300000',
    10
  ); // 5 minutes default

  private telemedicineGateway: TelemedicineGateway | null = null; // Will be set via setter to avoid circular dependency

  constructor(
    @InjectRepository(TelemedicineSession)
    private sessionRepository = getRepository(TelemedicineSession),
    @InjectRepository(TelemedicineMessage)
    private messageRepository = getRepository(TelemedicineMessage),
    @Inject(forwardRef(() => ClientService))
    private clientService: ClientService,
    @Inject(forwardRef(() => CommerceService))
    private commerceService: CommerceService,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
    @Inject(forwardRef(() => ClientPortalService))
    @Optional()
    private clientPortalService?: ClientPortalService
  ) {
    // Initialize AWS S3
    AWS.config.update({
      apiVersion: '2006-03-01',
      region: process.env.AWS_DEFAULT_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    this.s3 = new AWS.S3();
  }

  /**
   * Set gateway reference (called by gateway to avoid circular dependency)
   */
  setGateway(gateway: TelemedicineGateway): void {
    this.telemedicineGateway = gateway;
  }

  /**
   * Crear sesión de telemedicina
   */
  async createSession(
    user: string,
    dto: CreateTelemedicineSessionDto
  ): Promise<TelemedicineSession> {
    const session = new TelemedicineSession();
    session.id = uuidv4();
    session.commerceId = dto.commerceId;
    session.clientId = dto.clientId;
    session.doctorId = dto.doctorId;
    session.attentionId = dto.attentionId;
    session.patientHistoryId = dto.patientHistoryId;
    session.type = dto.type;
    session.status = TelemedicineSessionStatus.SCHEDULED;
    session.scheduledAt = new Date(dto.scheduledAt);
    session.recordingEnabled = dto.recordingEnabled || false;
    session.consentGiven = false;
    session.notes = dto.notes;
    session.roomId = this.generateRoomId();
    session.roomName = `Sesión ${session.id.substring(0, 8)}`;
    const accessKey = this.generateAccessKey();
    session.accessKey = accessKey; // Store plaintext for sending (will be excluded from responses)
    session.accessKeyHash = this.hashAccessKey(accessKey); // Store hash for secure validation
    session.accessKeySent = false;
    session.accessKeyValidated = false;
    session.accessKeyValidationAttempts = 0;
    session.active = true;
    session.available = true;
    session.createdAt = new Date();
    session.createdBy = user;
    session.updatedAt = new Date();

    const created = await this.sessionRepository.create(session);
    this.logger.log(`Created telemedicine session: ${created.id}`);

    // Publish event
    const event = new TelemedicineSessionCreated(new Date(), created, {
      userId: user,
      commerceId: created.commerceId,
    });
    publish(event);

    // Retornar sin accessKey por seguridad
    return this.excludeAccessKey(created);
  }

  /**
   * Iniciar sesión
   */
  async startSession(sessionId: string, userId: string): Promise<TelemedicineSession> {
    const session = await this.getSessionByIdInternal(sessionId);

    if (session.status !== TelemedicineSessionStatus.SCHEDULED) {
      throw new HttpException(
        'Session can only be started if it is scheduled',
        HttpStatus.BAD_REQUEST
      );
    }

    session.status = TelemedicineSessionStatus.ACTIVE;
    session.startedAt = new Date();
    session.lastActivityAt = new Date(); // Initialize activity tracking
    session.updatedAt = new Date();
    session.updatedBy = userId;

    const updated = await this.sessionRepository.update(session);
    this.logger.log(`Started telemedicine session: ${sessionId}`);

    // Publish event
    const event = new TelemedicineSessionStarted(new Date(), updated, {
      userId,
      commerceId: updated.commerceId,
    });
    publish(event);

    // Retornar sin accessKey por seguridad
    return this.excludeAccessKey(updated);
  }

  /**
   * Finalizar sesión
   */
  async endSession(
    sessionId: string,
    userId: string,
    notes?: string,
    diagnosis?: string
  ): Promise<TelemedicineSession> {
    const session = await this.getSessionByIdInternal(sessionId);

    if (session.status !== TelemedicineSessionStatus.ACTIVE) {
      throw new HttpException('Session can only be ended if it is active', HttpStatus.BAD_REQUEST);
    }

    session.status = TelemedicineSessionStatus.COMPLETED;
    session.endedAt = new Date();
    session.endedBy = userId; // Guardar quién cerró la sesión

    // Clear room connection state when session ends
    await this.clearRoomConnectionState(sessionId);

    if (session.startedAt) {
      const durationMs = session.endedAt.getTime() - session.startedAt.getTime();
      session.duration = Math.round(durationMs / 60000); // Duración en minutos
    }

    if (notes) session.notes = notes;
    if (diagnosis) session.diagnosis = diagnosis;

    session.updatedAt = new Date();
    session.updatedBy = userId;

    const updated = await this.sessionRepository.update(session);
    this.logger.log(`Ended telemedicine session: ${sessionId}`);

    // Notificar a todos los clientes conectados en la sala que la sesión ha finalizado
    // Gateway is set via setter to avoid circular dependency
    try {
      if (this.telemedicineGateway && updated.roomId) {
        this.telemedicineGateway.notifySessionCompleted(updated.roomId, updated.id);
        this.logger.log(
          `Notified clients in room ${updated.roomId} that session ${sessionId} has completed`
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to notify clients of session completion: ${error.message}`);
      // No lanzar error, la sesión ya se completó
    }

    // Actualizar la atención con la información de telemedicina
    if (updated.attentionId) {
      try {
        const { AttentionService } = await import('../attention/attention.service');
        const { getRepository } = await import('fireorm');
        const { Attention } = await import('../attention/model/attention.entity');
        const attentionRepository = getRepository(Attention);
        const attention = await attentionRepository.findById(updated.attentionId);

        if (attention) {
          attention.telemedicineInfo = {
            patientConnectedAt: updated.patientConnectedAt,
            doctorConnectedAt: updated.doctorConnectedAt,
            endedAt: updated.endedAt,
            endedBy: updated.endedBy,
            duration: updated.duration,
          };
          await attentionRepository.update(attention);
          this.logger.log(`Updated attention ${updated.attentionId} with telemedicine info`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to update attention with telemedicine info: ${error.message}`,
          error.stack
        );
      }
    }

    // Publish event
    const event = new TelemedicineSessionEnded(new Date(), updated, {
      userId,
      commerceId: updated.commerceId,
      duration: updated.duration,
    });
    publish(event);

    // Retornar sin accessKey por seguridad
    return this.excludeAccessKey(updated);
  }

  /**
   * Cancelar sesión
   */
  async cancelSession(sessionId: string, userId: string): Promise<TelemedicineSession> {
    const session = await this.getSessionByIdInternal(sessionId);

    if (session.status === TelemedicineSessionStatus.COMPLETED) {
      throw new HttpException('Cannot cancel a completed session', HttpStatus.BAD_REQUEST);
    }

    session.status = TelemedicineSessionStatus.CANCELLED;
    session.updatedAt = new Date();
    session.updatedBy = userId;

    // Clear room connection state when session is cancelled
    await this.clearRoomConnectionState(sessionId);

    const updated = await this.sessionRepository.update(session);
    this.logger.log(`Cancelled telemedicine session: ${sessionId}`);

    // Publish event
    const event = new TelemedicineSessionCancelled(new Date(), updated, {
      userId,
      commerceId: updated.commerceId,
    });
    publish(event);

    // Retornar sin accessKey por seguridad
    return this.excludeAccessKey(updated);
  }

  /**
   * Obtener sesión por ID (uso interno, incluye accessKey)
   */
  private async getSessionByIdInternal(id: string): Promise<TelemedicineSession> {
    const session = await this.sessionRepository.findById(id);
    if (!session) {
      throw new HttpException('Telemedicine session not found', HttpStatus.NOT_FOUND);
    }
    return session;
  }

  /**
   * Obtener sesión por ID (público, sin accessKey)
   */
  async getSessionById(id: string): Promise<TelemedicineSession> {
    const session = await this.getSessionByIdInternal(id);
    // Retornar sin accessKey por seguridad
    return this.excludeAccessKey(session);
  }

  /**
   * Listar sesiones
   */
  async listSessions(
    commerceId?: string,
    clientId?: string,
    doctorId?: string,
    status?: TelemedicineSessionStatus
  ): Promise<TelemedicineSession[]> {
    let query = this.sessionRepository.whereEqualTo('active', true);

    if (commerceId) {
      query = query.whereEqualTo('commerceId', commerceId);
    }

    if (clientId) {
      query = query.whereEqualTo('clientId', clientId);
    }

    if (doctorId) {
      query = query.whereEqualTo('doctorId', doctorId);
    }

    if (status) {
      query = query.whereEqualTo('status', status);
    }

    const sessions = await query.orderByDescending('scheduledAt').find();
    // Excluir accessKey de todas las sesiones por seguridad
    return sessions.map(session => this.excludeAccessKey(session));
  }

  /**
   * Enviar mensaje
   */
  async sendMessage(
    sessionId: string,
    senderId: string,
    senderType: MessageSenderType,
    dto: SendMessageDto
  ): Promise<TelemedicineMessage> {
    // Verificar que la sesión existe y está activa
    const session = await this.getSessionByIdInternal(sessionId);

    if (session.status === TelemedicineSessionStatus.CANCELLED) {
      throw new HttpException(
        'Cannot send messages to a cancelled session',
        HttpStatus.BAD_REQUEST
      );
    }

    const message = new TelemedicineMessage();
    message.id = uuidv4();
    message.sessionId = sessionId;
    message.senderId = senderId;
    message.senderType = senderType;
    message.message = dto.message;
    message.attachments = dto.attachments;
    message.timestamp = new Date();
    message.read = false;
    message.active = true;
    message.available = true;
    message.createdAt = new Date();

    const created = await this.messageRepository.create(message);
    this.logger.log(`Message sent in session: ${sessionId}`);

    // Publicar evento TelemedicineMessageSent
    const event = new TelemedicineMessageSent(new Date(), created, {
      sessionId: sessionId,
      commerceId: session.commerceId,
      senderType: created.senderType,
      attentionId: session.attentionId,
    });
    publish(event);

    return created;
  }

  /**
   * Obtener mensajes de una sesión
   */
  async getMessages(sessionId: string): Promise<TelemedicineMessage[]> {
    return await this.messageRepository
      .whereEqualTo('sessionId', sessionId)
      .whereEqualTo('active', true)
      .orderByAscending('timestamp')
      .find();
  }

  /**
   * Marcar mensajes como leídos
   */
  async markMessagesAsRead(sessionId: string, userId: string): Promise<void> {
    const messages = await this.getMessages(sessionId);
    const unreadMessages = messages.filter(m => !m.read && m.senderId !== userId);

    for (const message of unreadMessages) {
      message.read = true;
      message.readAt = new Date();
      await this.messageRepository.update(message);
    }
  }

  /**
   * Dar consentimiento para grabación
   */
  async giveConsent(sessionId: string, patientId: string): Promise<TelemedicineSession> {
    const session = await this.getSessionById(sessionId);

    if (session.clientId !== patientId) {
      throw new HttpException('Only the patient can give consent', HttpStatus.FORBIDDEN);
    }

    session.consentGiven = true;
    session.consentGivenAt = new Date();
    session.updatedAt = new Date();

    const updated = await this.sessionRepository.update(session);
    // Retornar sin accessKey por seguridad
    return this.excludeAccessKey(updated);
  }

  /**
   * Guardar URL de grabación
   */
  async saveRecordingUrl(sessionId: string, recordingUrl: string): Promise<TelemedicineSession> {
    const session = await this.getSessionByIdInternal(sessionId);
    session.recordingUrl = recordingUrl;
    session.updatedAt = new Date();

    const updated = await this.sessionRepository.update(session);
    // Retornar sin accessKey por seguridad
    return this.excludeAccessKey(updated);
  }

  /**
   * Generar URL presignada para subir grabación directamente a S3
   * Esto permite que el cliente suba directamente sin pasar por el backend
   */
  async getRecordingUploadUrl(
    sessionId: string,
    user: string,
    expiresIn = 3600 // Default 1 hour
  ): Promise<{ uploadUrl: string; recordingKey: string; recordingUrl: string }> {
    const session = await this.getSessionByIdInternal(sessionId);

    // Verificar configuración del comercio para grabación
    try {
      const commerce = await this.commerceService.getCommerce(session.commerceId);
      if (!commerce.telemedicineRecordingEnabled) {
        throw new HttpException(
          'La grabación de sesiones de telemedicina está deshabilitada para este comercio',
          HttpStatus.FORBIDDEN
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.warn(`Could not verify commerce recording configuration: ${error.message}`);
      throw new HttpException(
        'No se pudo verificar la configuración de grabación del comercio',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    const bucket = process.env.AWS_S3_COMMERCE_BUCKET || process.env.AWS_S3_BUCKET;
    if (!bucket) {
      throw new HttpException(
        'Configuración de S3 no encontrada',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    const recordingKey = `telemedicine/${session.commerceId}/${sessionId}-${Date.now()}.webm`;
    const recordingUrl = `https://${bucket}.s3.${
      process.env.AWS_DEFAULT_REGION || 'us-east-2'
    }.amazonaws.com/${recordingKey}`;

    try {
      // Generate presigned URL for PUT operation
      const uploadUrl = await this.s3.getSignedUrlPromise('putObject', {
        Bucket: bucket,
        Key: recordingKey,
        ContentType: 'video/webm',
        Expires: expiresIn,
        Metadata: {
          sessionId: sessionId,
          commerceId: session.commerceId,
          uploadedBy: user,
        },
        ServerSideEncryption: 'AES256', // Enable encryption at rest
      });

      this.logger.log(`Generated presigned upload URL for session ${sessionId}: ${recordingKey}`);

      return {
        uploadUrl,
        recordingKey,
        recordingUrl,
      };
    } catch (error) {
      this.logger.error(`Error generating presigned URL: ${error.message}`);
      throw new HttpException(
        `Error generando URL de subida: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Guardar URL de grabación después de subida directa a S3
   */
  async saveRecordingUrlFromPresignedUpload(
    sessionId: string,
    recordingKey: string,
    user: string
  ): Promise<TelemedicineSession> {
    const session = await this.getSessionByIdInternal(sessionId);
    const bucket = process.env.AWS_S3_COMMERCE_BUCKET || process.env.AWS_S3_BUCKET;

    if (!bucket) {
      throw new HttpException(
        'Configuración de S3 no encontrada',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    // Construct the S3 URL
    const recordingUrl = `https://${bucket}.s3.${
      process.env.AWS_DEFAULT_REGION || 'us-east-2'
    }.amazonaws.com/${recordingKey}`;

    session.recordingUrl = recordingUrl;
    session.updatedAt = new Date();
    session.updatedBy = user;

    const updated = await this.sessionRepository.update(session);

    this.logger.log(`Recording URL saved for session ${sessionId}: ${recordingUrl}`);

    return this.excludeAccessKey(updated);
  }

  /**
   * Subir grabación a S3 (legacy method - prefer getRecordingUploadUrl for new implementations)
   */
  async uploadRecording(sessionId: string, file: any, user: string): Promise<TelemedicineSession> {
    const session = await this.getSessionByIdInternal(sessionId);

    if (!file) {
      throw new HttpException('Archivo no enviado', HttpStatus.BAD_REQUEST);
    }

    // Verificar configuración del comercio para grabación
    try {
      const commerce = await this.commerceService.getCommerce(session.commerceId);
      if (!commerce.telemedicineRecordingEnabled) {
        throw new HttpException(
          'La grabación de sesiones de telemedicina está deshabilitada para este comercio',
          HttpStatus.FORBIDDEN
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.warn(`Could not verify commerce recording configuration: ${error.message}`);
      // Si no se puede verificar, no permitir la grabación por seguridad
      throw new HttpException(
        'No se pudo verificar la configuración de grabación del comercio',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    const bucket = process.env.AWS_S3_COMMERCE_BUCKET || process.env.AWS_S3_BUCKET;
    if (!bucket) {
      throw new HttpException(
        'Configuración de S3 no encontrada',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    const filename = `telemedicine/${session.commerceId}/${sessionId}-${Date.now()}.webm`;

    try {
      const uploadResult = await this.s3
        .upload({
          Bucket: bucket,
          Key: filename,
          Body: file.buffer,
          ContentType: 'video/webm',
          ACL: 'private',
          ServerSideEncryption: 'AES256', // Enable encryption at rest
          Metadata: {
            sessionId: sessionId,
            commerceId: session.commerceId,
            uploadedBy: user,
          },
        })
        .promise();

      // Save recording URL
      session.recordingUrl = uploadResult.Location;
      session.updatedAt = new Date();

      const updated = await this.sessionRepository.update(session);

      this.logger.log(`Recording uploaded for session ${sessionId}: ${uploadResult.Location}`);

      // Retornar sin accessKey por seguridad
      return this.excludeAccessKey(updated);
    } catch (error) {
      this.logger.error(`Error uploading recording: ${error.message}`);
      throw new HttpException(
        `Error subiendo grabación: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Validar clave de acceso y obtener sesión
   * Includes rate limiting and brute force protection
   */
  async validateAccessKey(sessionId: string, accessKey: string): Promise<TelemedicineSession> {
    const session = await this.getSessionByIdInternal(sessionId);

    // Check if session has access key configured
    if (!session.accessKey && !session.accessKeyHash) {
      throw new HttpException('Session does not have an access key', HttpStatus.BAD_REQUEST);
    }

    // Check if key is locked due to too many failed attempts
    if (session.accessKeyLockedUntil && new Date() < session.accessKeyLockedUntil) {
      const minutesRemaining = Math.ceil(
        (session.accessKeyLockedUntil.getTime() - Date.now()) / 60000
      );
      throw new HttpException(
        `Too many failed attempts. Please try again in ${minutesRemaining} minute(s)`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Verify access key (supports both legacy plaintext and new hashed keys)
    const isValid = this.verifyAccessKey(accessKey, session.accessKey || '', session.accessKeyHash);

    if (!isValid) {
      // Increment failed attempts counter
      const attempts = (session.accessKeyValidationAttempts || 0) + 1;
      session.accessKeyValidationAttempts = attempts;

      // Lock after 5 failed attempts for 30 minutes
      if (attempts >= 5) {
        session.accessKeyLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        this.logger.warn(
          `Access key locked for session ${sessionId} after ${attempts} failed attempts`
        );
      }

      session.updatedAt = new Date();
      await this.sessionRepository.update(session);

      this.logger.warn(`Invalid access key attempt for session ${sessionId} (attempt ${attempts})`);
      throw new HttpException('Invalid access key', HttpStatus.UNAUTHORIZED);
    }

    // Reset failed attempts on successful validation
    session.accessKeyValidated = true;
    session.accessKeyValidatedAt = new Date();
    session.accessKeyValidationAttempts = 0;
    session.accessKeyLockedUntil = undefined;
    session.updatedAt = new Date();

    const updated = await this.sessionRepository.update(session);

    // Publish event
    const event = new TelemedicineAccessKeyValidated(new Date(), updated, {
      commerceId: updated.commerceId,
    });
    publish(event);

    // Retornar sesión sin accessKey por seguridad
    return this.excludeAccessKey(updated);
  }

  /**
   * Validar sesión usando token del portal del cliente
   * Permite acceso automático si el cliente tiene sesión del portal activa
   */
  async validateWithPortalSession(
    sessionId: string,
    portalToken: string
  ): Promise<TelemedicineSession> {
    if (!this.clientPortalService) {
      throw new HttpException(
        'Portal session validation not available',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    const session = await this.getSessionByIdInternal(sessionId);

    // Verificar que la sesión existe y está activa
    if (!session || !session.active) {
      throw new HttpException('Session not found or inactive', HttpStatus.NOT_FOUND);
    }

    // Verificar que la sesión no esté completada o cancelada
    if (session.status === 'completed' || session.status === 'cancelled') {
      throw new HttpException('Session is no longer available', HttpStatus.BAD_REQUEST);
    }

    // Validar token del portal
    const portalSession = await this.clientPortalService.validateSession(portalToken);
    if (!portalSession.valid || portalSession.expired) {
      throw new HttpException('Invalid or expired portal session', HttpStatus.UNAUTHORIZED);
    }

    // Verificar que el cliente de la sesión del portal coincide con el de telemedicina
    if (
      portalSession.client?.id !== session.clientId ||
      portalSession.commerce?.id !== session.commerceId
    ) {
      throw new HttpException(
        'Portal session client does not match telemedicine session client',
        HttpStatus.FORBIDDEN
      );
    }

    // Marcar como validada (similar a validateAccessKey pero sin código)
    session.accessKeyValidated = true;
    session.accessKeyValidatedAt = new Date();
    session.updatedAt = new Date();

    const updated = await this.sessionRepository.update(session);

    // Publish event
    const event = new TelemedicineAccessKeyValidated(new Date(), updated, {
      commerceId: updated.commerceId,
      validatedVia: 'portal-session',
    });
    publish(event);

    this.logger.log(
      `Telemedicine session ${sessionId} validated via portal session for client ${session.clientId}`
    );

    // Retornar sesión sin accessKey por seguridad
    return this.excludeAccessKey(updated);
  }

  /**
   * Obtener sesión por ID sin validación de acceso (para uso interno)
   */
  async getSessionByIdPublic(sessionId: string): Promise<TelemedicineSession> {
    const session = await this.getSessionById(sessionId);
    return this.excludeAccessKey(session);
  }

  /**
   * Get access key for a session (for notification purposes only)
   */
  async getAccessKeyForNotification(sessionId: string): Promise<string | null> {
    const session = await this.getSessionByIdInternal(sessionId);
    return session.accessKey || null;
  }

  /**
   * Excluir accessKey y accessKeyHash de la sesión para respuestas públicas
   */
  private excludeAccessKey(session: TelemedicineSession): TelemedicineSession {
    const { accessKey, accessKeyHash, ...sessionWithoutKey } = session;
    return sessionWithoutKey as TelemedicineSession;
  }

  /**
   * Marcar clave de acceso como enviada
   */
  async markAccessKeyAsSent(sessionId: string): Promise<TelemedicineSession> {
    const session = await this.getSessionByIdInternal(sessionId);
    session.accessKeySent = true;
    session.accessKeySentAt = new Date();
    session.updatedAt = new Date();
    const updated = await this.sessionRepository.update(session);
    // Retornar sin accessKey por seguridad
    return this.excludeAccessKey(updated);
  }

  /**
   * Obtener sesiones que necesitan enviar clave de acceso (10 minutos antes)
   */
  async getSessionsNeedingAccessKey(): Promise<TelemedicineSession[]> {
    const now = new Date();
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
    const oneMinuteFromNow = new Date(now.getTime() + 1 * 60 * 1000);

    // Get all scheduled sessions that haven't sent access key
    const allSessions = await this.sessionRepository
      .whereEqualTo('status', TelemedicineSessionStatus.SCHEDULED)
      .whereEqualTo('accessKeySent', false)
      .whereEqualTo('active', true)
      .find();

    // Filter by date range in memory (FireORM date queries can be tricky)
    return allSessions.filter(session => {
      const scheduledAt = new Date(session.scheduledAt);
      return scheduledAt >= oneMinuteFromNow && scheduledAt <= tenMinutesFromNow;
    });
  }

  /**
   * Generar ID único para la sala
   */
  private generateRoomId(): string {
    return `room_${uuidv4().replace(/-/g, '')}`;
  }

  /**
   * Generar clave de acceso única y segura
   * Uses cryptographically secure random for better security
   */
  private generateAccessKey(): string {
    // Generate 8-character alphanumeric code using crypto secure random
    // Use a pool of uppercase letters and numbers to guarantee 8 characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const bytes = crypto.randomBytes(8); // Generate 8 random bytes

    // Convert each byte to an index in our character pool
    for (let i = 0; i < 8; i++) {
      result += chars[bytes[i] % chars.length];
    }

    return result;
  }

  /**
   * Hash access key for secure storage comparison
   * Uses SHA-256 with a salt (or just SHA-256 for now)
   */
  private hashAccessKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Verify access key against stored hash
   * Supports both legacy plaintext and new hashed keys for backward compatibility
   */
  private verifyAccessKey(providedKey: string, storedKey: string, storedHash?: string): boolean {
    // New sessions with hashed keys
    if (storedHash) {
      const providedHash = this.hashAccessKey(providedKey);
      // Use string comparison for now (both are hex strings of same length)
      // timingSafeEqual requires same-length buffers, but we can compare hex strings directly
      // For security, we still hash both and compare the hashes
      return providedHash === storedHash;
    }
    // Legacy sessions with plaintext keys (backward compatibility)
    return storedKey === providedKey;
  }

  /**
   * Enviar clave de acceso por WhatsApp/Email cuando el usuario solicita
   */
  async sendAccessKeyOnDemand(sessionId: string): Promise<TelemedicineSession> {
    const session = await this.getSessionByIdInternal(sessionId);

    // Don't send access key if session is completed or cancelled
    if (
      session.status === TelemedicineSessionStatus.COMPLETED ||
      session.status === TelemedicineSessionStatus.CANCELLED
    ) {
      this.logger.warn(
        `[TelemedicineService] Cannot send access key for session ${sessionId}: session is ${session.status}`
      );
      throw new HttpException(
        `Cannot send access key: session is ${session.status}`,
        HttpStatus.BAD_REQUEST
      );
    }

    if (!session.accessKey) {
      throw new HttpException('Session does not have an access key', HttpStatus.BAD_REQUEST);
    }

    // Get client information
    const client = await this.clientService.getClientById(session.clientId);
    if (!client) {
      throw new HttpException('Client not found', HttpStatus.NOT_FOUND);
    }

    // Get commerce information
    const commerce = await this.commerceService.getCommerce(session.commerceId);
    if (!commerce) {
      throw new HttpException('Commerce not found', HttpStatus.NOT_FOUND);
    }

    const accessLink = `${
      process.env.BACKEND_URL || 'http://localhost:5173'
    }/publico/telemedicina/${session.id}`;
    const scheduledDate = new Date(session.scheduledAt).toLocaleString('es-ES', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
    const message = `🔐 *Clave de acceso para tu consulta de telemedicina*\n\n📋 *Código:* ${session.accessKey}\n\n🔗 *Enlace:* ${accessLink}\n\n📅 *Fecha programada:* ${scheduledDate}\n\nIngresa el código cuando se te solicite para acceder a tu consulta.`;

    try {
      let whatsappSent = false;
      let emailSent = false;

      // Send via WhatsApp if phone is available
      if (!client.phone) {
        this.logger.warn(
          `[TelemedicineService] Client ${session.clientId} does not have a phone number for session ${sessionId}`
        );
      } else {
        // Get service phone number following the same pattern as attention and booking services
        let servicePhoneNumber = undefined;
        let whatsappConnection;
        if (
          commerce.whatsappConnection &&
          commerce.whatsappConnection.connected === true &&
          commerce.whatsappConnection.whatsapp
        ) {
          whatsappConnection = commerce.whatsappConnection;
        }
        if (
          whatsappConnection &&
          whatsappConnection.connected === true &&
          whatsappConnection.whatsapp
        ) {
          servicePhoneNumber = whatsappConnection.whatsapp;
        }
        // Fallback to global WhatsApp number if commerce doesn't have one configured or connected
        if (!servicePhoneNumber) {
          servicePhoneNumber = process.env.WHATSGW_PHONE_NUMBER;
        }

        this.logger.log(`[TelemedicineService] WhatsApp configuration check:`, {
          sessionId,
          clientId: session.clientId,
          clientPhone: client.phone,
          commerceId: session.commerceId,
          whatsappConnection: commerce.whatsappConnection
            ? {
                connected: commerce.whatsappConnection.connected,
                whatsapp: commerce.whatsappConnection.whatsapp,
              }
            : 'not configured',
          servicePhoneNumber: servicePhoneNumber || 'NOT SET',
          envVar: process.env.WHATSGW_PHONE_NUMBER || 'NOT SET',
          usingCommerceNumber: !!whatsappConnection?.whatsapp,
          usingGlobalNumber: !whatsappConnection?.whatsapp && !!process.env.WHATSGW_PHONE_NUMBER,
        });

        if (!servicePhoneNumber) {
          this.logger.warn(
            `[TelemedicineService] No WhatsApp service phone number configured for commerce ${session.commerceId}. Check commerce.whatsappConnection.whatsapp or WHATSGW_PHONE_NUMBER env var`
          );
        } else {
          try {
            this.logger.log(`[TelemedicineService] Attempting to send WhatsApp notification:`, {
              sessionId,
              from: servicePhoneNumber,
              to: client.phone,
              clientId: session.clientId,
              messagePreview: message.substring(0, 50) + '...',
            });
            await this.notificationService.createWhatsappNotification(
              client.phone,
              session.clientId,
              message,
              NotificationType.TELEMEDICINE_ACCESS_KEY,
              session.attentionId || '',
              session.commerceId,
              '',
              servicePhoneNumber
            );
            this.logger.log(`[TelemedicineService] Access key sent via WhatsApp successfully:`, {
              sessionId,
              to: client.phone,
              from: servicePhoneNumber,
            });
            whatsappSent = true;
          } catch (error) {
            this.logger.error(
              `[TelemedicineService] Failed to send WhatsApp notification for session ${sessionId}:`,
              {
                error: error.message,
                stack: error.stack,
                to: client.phone,
                from: servicePhoneNumber,
                clientId: session.clientId,
              }
            );
            // Continue to try email even if WhatsApp fails
          }
        }
      }

      // Send via Email if email is available (ALWAYS try if email exists, not just as fallback)
      if (client.email) {
        try {
          // Get commerce language for email translation
          const commerceLanguage = commerce.localeInfo?.language || 'es';

          // Get translated email content
          const emailContent = getTelemedicineAccessKeyEmail(
            commerceLanguage,
            session.accessKey,
            accessLink,
            scheduledDate
          );

          this.logger.log(`[TelemedicineService] Attempting to send email notification:`, {
            sessionId,
            to: client.email,
            clientId: session.clientId,
            subject: emailContent.subject,
            language: commerceLanguage,
          });

          await this.notificationService.createAttentionRawEmailNotification(
            NotificationType.TELEMEDICINE_ACCESS_KEY,
            session.attentionId || '',
            session.commerceId,
            process.env.EMAIL_SOURCE || 'noreply@easuavez.com',
            [client.email],
            emailContent.subject,
            [], // attachments
            emailContent.html
          );

          this.logger.log(`[TelemedicineService] Access key sent via email successfully:`, {
            sessionId,
            to: client.email,
            language: commerceLanguage,
          });
          emailSent = true;
        } catch (error) {
          this.logger.error(
            `[TelemedicineService] Failed to send email notification for session ${sessionId}:`,
            {
              error: error.message,
              stack: error.stack,
              to: client.email,
              clientId: session.clientId,
            }
          );
        }
      } else {
        this.logger.warn(
          `[TelemedicineService] Client ${session.clientId} does not have an email for session ${sessionId}`
        );
      }

      // Check if at least one notification was sent
      const sent = whatsappSent || emailSent;

      if (!sent) {
        this.logger.warn(
          `Could not send access key for session ${sessionId}. Client phone: ${
            client.phone || 'N/A'
          }, Client email: ${client.email || 'N/A'}`
        );
        // Don't mark as sent or publish event if no message was sent
        const updatedSession = await this.getSessionByIdInternal(sessionId);
        return this.excludeAccessKey(updatedSession);
      }

      // Log summary of what was sent
      this.logger.log(`[TelemedicineService] Access key delivery summary for session ${sessionId}:`, {
        whatsappSent,
        emailSent,
        clientPhone: client.phone || 'N/A',
        clientEmail: client.email || 'N/A',
        bothChannelsUsed: whatsappSent && emailSent,
      });

      // Mark access key as sent if not already sent
      if (!session.accessKeySent) {
        await this.markAccessKeyAsSent(session.id);
      }

      // Publish event only if message was successfully sent
      const event = new TelemedicineAccessKeySent(new Date(), session, {
        commerceId: session.commerceId,
        clientId: session.clientId,
      });
      publish(event);

      // Retornar sesión sin accessKey por seguridad
      const updatedSession = await this.getSessionByIdInternal(sessionId);
      return this.excludeAccessKey(updatedSession);
    } catch (error) {
      this.logger.error(
        `Failed to send access key on demand for session ${sessionId}: ${error.message}`,
        error.stack
      );
      throw new HttpException(
        `Error al enviar la clave de acceso: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Marcar paciente como conectado
   */
  async markPatientConnected(sessionId: string): Promise<TelemedicineSession> {
    const session = await this.getSessionByIdInternal(sessionId);

    if (!session.patientConnectedAt) {
      session.patientConnectedAt = new Date();
      session.lastActivityAt = new Date(); // Update activity
      session.updatedAt = new Date();
      const updated = await this.sessionRepository.update(session);
      this.logger.log(`Patient connected to session: ${sessionId}`);

      // Actualizar la atención con la información de conexión del paciente
      if (updated.attentionId) {
        try {
          const { getRepository } = await import('fireorm');
          const { Attention } = await import('../attention/model/attention.entity');
          const attentionRepository = getRepository(Attention);
          const attention = await attentionRepository.findById(updated.attentionId);

          if (attention) {
            if (!attention.telemedicineInfo) {
              attention.telemedicineInfo = {};
            }
            attention.telemedicineInfo.patientConnectedAt = updated.patientConnectedAt;
            await attentionRepository.update(attention);
          }
        } catch (error) {
          this.logger.error(
            `Failed to update attention with patient connection: ${error.message}`,
            error.stack
          );
        }
      }

      // Publicar evento TelemedicinePatientConnected
      const event = new TelemedicinePatientConnected(new Date(), updated, {
        sessionId: updated.id,
        commerceId: updated.commerceId,
        clientId: updated.clientId,
        attentionId: updated.attentionId,
      });
      publish(event);

      return this.excludeAccessKey(updated);
    }

    return this.excludeAccessKey(session);
  }

  /**
   * Marcar doctor como conectado
   */
  async markDoctorConnected(sessionId: string, userId: string): Promise<TelemedicineSession> {
    const session = await this.getSessionByIdInternal(sessionId);

    if (!session.doctorConnectedAt) {
      session.doctorConnectedAt = new Date();
      session.lastActivityAt = new Date(); // Update activity
      session.updatedAt = new Date();
      session.updatedBy = userId;
      const updated = await this.sessionRepository.update(session);
      this.logger.log(`Doctor connected to session: ${sessionId}`);

      // Actualizar la atención con la información de conexión del doctor
      if (updated.attentionId) {
        try {
          const { getRepository } = await import('fireorm');
          const { Attention } = await import('../attention/model/attention.entity');
          const attentionRepository = getRepository(Attention);
          const attention = await attentionRepository.findById(updated.attentionId);

          if (attention) {
            if (!attention.telemedicineInfo) {
              attention.telemedicineInfo = {};
            }
            attention.telemedicineInfo.doctorConnectedAt = updated.doctorConnectedAt;
            await attentionRepository.update(attention);
          }
        } catch (error) {
          this.logger.error(
            `Failed to update attention with doctor connection: ${error.message}`,
            error.stack
          );
        }
      }

      // Publicar evento TelemedicineDoctorConnected
      const event = new TelemedicineDoctorConnected(new Date(), updated, {
        sessionId: updated.id,
        commerceId: updated.commerceId,
        doctorId: userId,
        attentionId: updated.attentionId,
      });
      publish(event);

      return this.excludeAccessKey(updated);
    }

    return this.excludeAccessKey(session);
  }

  /**
   * Procesar y enviar claves de acceso para sesiones próximas
   */
  async processAccessKeysForUpcomingSessions(): Promise<number> {
    const sessions = await this.getSessionsNeedingAccessKey();
    let sentCount = 0;

    for (const session of sessions) {
      try {
        // Double-check session status before sending (in case it changed since query)
        const currentSession = await this.getSessionByIdInternal(session.id);
        if (
          currentSession.status === TelemedicineSessionStatus.COMPLETED ||
          currentSession.status === TelemedicineSessionStatus.CANCELLED
        ) {
          this.logger.warn(
            `[TelemedicineService] Skipping access key send for session ${session.id}: session is ${currentSession.status}`
          );
          continue;
        }

        // Send notification with access key
        await this.notificationService.createNotification({
          userId: session.clientId,
          commerceId: session.commerceId,
          type: NotificationType.TELEMEDICINE_ACCESS_KEY,
          title: 'Clave de acceso para tu consulta de telemedicina',
          message: `Tu clave de acceso es: ${session.accessKey}`,
          data: {
            sessionId: session.id,
            accessKey: session.accessKey,
            scheduledAt: session.scheduledAt,
          },
        });

        // Mark access key as sent
        await this.markAccessKeyAsSent(session.id);

        // Publish event
        const event = new TelemedicineAccessKeySent(new Date(), session, {
          commerceId: session.commerceId,
          clientId: session.clientId,
        });
        publish(event);

        sentCount++;
        this.logger.log(`Access key sent for session: ${session.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to send access key for session ${session.id}: ${error.message}`,
          error.stack
        );
      }
    }

    return sentCount;
  }

  /**
   * Lifecycle: Initialize cleanup and timeout checks
   */
  onModuleInit(): void {
    this.logger.log('Initializing telemedicine session cleanup and timeout checks');
    this.startCleanupJob();
    this.startTimeoutCheck();
  }

  /**
   * Lifecycle: Cleanup intervals on module destroy
   */
  onModuleDestroy(): void {
    this.logger.log('Stopping telemedicine session cleanup and timeout checks');
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = null;
    }
  }

  /**
   * Start periodic cleanup job for stale sessions
   */
  private startCleanupJob(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions().catch(error => {
        this.logger.error(`Error in cleanup job: ${error.message}`, error.stack);
      });
    }, this.CLEANUP_INTERVAL_MS);

    this.logger.log(`Started cleanup job (interval: ${this.CLEANUP_INTERVAL_MS / 1000}s)`);
  }

  /**
   * Start periodic timeout check for active sessions
   */
  private startTimeoutCheck(): void {
    // Check every minute for timed out sessions
    this.timeoutCheckInterval = setInterval(() => {
      this.checkAndTimeoutSessions().catch(error => {
        this.logger.error(`Error in timeout check: ${error.message}`, error.stack);
      });
    }, 60000); // Check every minute

    this.logger.log(
      `Started timeout check (timeout: ${
        this.SESSION_TIMEOUT_MS / 60000
      } minutes, check interval: 60s)`
    );
  }

  /**
   * Update last activity timestamp for a session
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      const session = await this.getSessionByIdInternal(sessionId);
      if (session && session.status === TelemedicineSessionStatus.ACTIVE) {
        session.lastActivityAt = new Date();
        session.updatedAt = new Date();
        await this.sessionRepository.update(session);
      }
    } catch (error) {
      // Silently fail - this is not critical
      this.logger.debug(`Could not update activity for session ${sessionId}: ${error.message}`);
    }
  }

  /**
   * Check active sessions and timeout those with no recent activity
   */
  async checkAndTimeoutSessions(): Promise<number> {
    const now = new Date();
    const timeoutThreshold = new Date(now.getTime() - this.SESSION_TIMEOUT_MS);
    let timedOutCount = 0;

    try {
      // Get all active sessions
      const activeSessions = await this.sessionRepository
        .whereEqualTo('status', TelemedicineSessionStatus.ACTIVE)
        .whereEqualTo('active', true)
        .find();

      for (const session of activeSessions) {
        // Check if session has timed out
        const lastActivity = session.lastActivityAt || session.startedAt || session.updatedAt;
        if (lastActivity && new Date(lastActivity) < timeoutThreshold) {
          try {
            // Timeout the session
            await this.endSession(
              session.id,
              'system',
              'Session timeout due to inactivity',
              undefined
            );
            timedOutCount++;
            this.logger.log(
              `Session ${session.id} timed out after ${Math.round(
                this.SESSION_TIMEOUT_MS / 60000
              )} minutes of inactivity`
            );
          } catch (error) {
            this.logger.error(
              `Failed to timeout session ${session.id}: ${error.message}`,
              error.stack
            );
          }
        }
      }

      if (timedOutCount > 0) {
        this.logger.log(`Timed out ${timedOutCount} inactive session(s)`);
      }
    } catch (error) {
      this.logger.error(`Error checking session timeouts: ${error.message}`, error.stack);
    }

    return timedOutCount;
  }

  /**
   * Cleanup stale sessions (scheduled/completed sessions older than retention period)
   */
  async cleanupStaleSessions(): Promise<number> {
    const RETENTION_DAYS = parseInt(process.env.TELEMEDICINE_RETENTION_DAYS || '90', 10); // Default 90 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    let cleanedCount = 0;

    try {
      // Get old completed/cancelled sessions
      const oldSessions = await this.sessionRepository
        .whereIn('status', [
          TelemedicineSessionStatus.COMPLETED,
          TelemedicineSessionStatus.CANCELLED,
        ])
        .whereEqualTo('active', true)
        .find();

      for (const session of oldSessions) {
        const sessionDate = session.endedAt || session.updatedAt || session.createdAt;
        if (sessionDate && new Date(sessionDate) < cutoffDate) {
          try {
            // Mark as inactive (soft delete)
            session.active = false;
            session.available = false;
            await this.sessionRepository.update(session);
            cleanedCount++;

            this.logger.debug(`Cleaned up old session: ${session.id} (${session.status})`);
          } catch (error) {
            this.logger.error(
              `Failed to cleanup session ${session.id}: ${error.message}`,
              error.stack
            );
          }
        }
      }

      if (cleanedCount > 0) {
        this.logger.log(
          `Cleaned up ${cleanedCount} stale session(s) older than ${RETENTION_DAYS} days`
        );
      }
    } catch (error) {
      this.logger.error(`Error cleaning up stale sessions: ${error.message}`, error.stack);
    }

    return cleanedCount;
  }

  /**
   * Get active sessions count (for monitoring)
   */
  async getActiveSessionsCount(): Promise<number> {
    try {
      const activeSessions = await this.sessionRepository
        .whereEqualTo('status', TelemedicineSessionStatus.ACTIVE)
        .whereEqualTo('active', true)
        .find();
      return activeSessions.length;
    } catch (error) {
      this.logger.error(`Error getting active sessions count: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get sessions statistics (for monitoring)
   */
  async getSessionsStatistics(): Promise<{
    total: number;
    active: number;
    scheduled: number;
    completed: number;
    cancelled: number;
  }> {
    try {
      const allSessions = await this.sessionRepository.whereEqualTo('active', true).find();

      return {
        total: allSessions.length,
        active: allSessions.filter(s => s.status === TelemedicineSessionStatus.ACTIVE).length,
        scheduled: allSessions.filter(s => s.status === TelemedicineSessionStatus.SCHEDULED).length,
        completed: allSessions.filter(s => s.status === TelemedicineSessionStatus.COMPLETED).length,
        cancelled: allSessions.filter(s => s.status === TelemedicineSessionStatus.CANCELLED).length,
      };
    } catch (error) {
      this.logger.error(`Error getting sessions statistics: ${error.message}`);
      return {
        total: 0,
        active: 0,
        scheduled: 0,
        completed: 0,
        cancelled: 0,
      };
    }
  }

  /**
   * Update room connection state in database
   * This persists the connected users to the database for state recovery
   */
  async updateRoomConnectionState(
    sessionId: string,
    connectedUsers: string[],
    connectedDoctorId?: string,
    connectedPatientId?: string
  ): Promise<void> {
    try {
      const session = await this.getSessionByIdInternal(sessionId);
      if (session) {
        session.connectedUsers = connectedUsers;
        session.connectedDoctorId = connectedDoctorId;
        session.connectedPatientId = connectedPatientId;
        session.lastRoomActivityAt = new Date();
        session.updatedAt = new Date();
        await this.sessionRepository.update(session);
        this.logger.debug(
          `Updated room connection state for session ${sessionId}: ${connectedUsers.length} users`
        );
      }
    } catch (error) {
      // Non-critical, log but don't fail
      this.logger.debug(
        `Could not update room connection state for session ${sessionId}: ${error.message}`
      );
    }
  }

  /**
   * Get active sessions with room state from database
   * Useful for state recovery and monitoring
   */
  async getActiveSessionsWithRoomState(): Promise<TelemedicineSession[]> {
    try {
      const activeSessions = await this.sessionRepository
        .whereEqualTo('status', TelemedicineSessionStatus.ACTIVE)
        .whereEqualTo('active', true)
        .find();

      // Filter sessions that have connected users
      return activeSessions.filter(
        session => session.connectedUsers && session.connectedUsers.length > 0
      );
    } catch (error) {
      this.logger.error(`Error getting active sessions with room state: ${error.message}`);
      return [];
    }
  }

  /**
   * Clear room connection state (when session ends or all users disconnect)
   */
  async clearRoomConnectionState(sessionId: string): Promise<void> {
    try {
      const session = await this.getSessionByIdInternal(sessionId);
      if (session) {
        session.connectedUsers = [];
        session.connectedDoctorId = undefined;
        session.connectedPatientId = undefined;
        session.lastRoomActivityAt = new Date();
        session.updatedAt = new Date();
        await this.sessionRepository.update(session);
        this.logger.debug(`Cleared room connection state for session ${sessionId}`);
      }
    } catch (error) {
      this.logger.debug(
        `Could not clear room connection state for session ${sessionId}: ${error.message}`
      );
    }
  }

  /**
   * Get room state from database for a specific session
   * Used for state recovery
   */
  async getRoomStateFromDatabase(sessionId: string): Promise<{
    connectedUsers: string[];
    connectedDoctorId?: string;
    connectedPatientId?: string;
  } | null> {
    try {
      const session = await this.getSessionByIdInternal(sessionId);
      if (session && session.connectedUsers) {
        return {
          connectedUsers: session.connectedUsers,
          connectedDoctorId: session.connectedDoctorId,
          connectedPatientId: session.connectedPatientId,
        };
      }
      return null;
    } catch (error) {
      this.logger.debug(
        `Could not get room state from database for session ${sessionId}: ${error.message}`
      );
      return null;
    }
  }
}
