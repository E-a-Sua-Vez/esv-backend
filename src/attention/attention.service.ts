import { HttpException, HttpStatus, Injectable, Inject, Optional, forwardRef } from '@nestjs/common';
import Bottleneck from 'bottleneck';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { CommerceKeyNameDetailsDto } from 'src/commerce/dto/commerce-keyname-details.dto';
import { DocumentsService } from 'src/documents/documents.service';
import { IncomeService } from 'src/income/income.service';
import { IncomeStatus } from 'src/income/model/income-status.enum';
import { IncomeType } from 'src/income/model/income-type.enum';
import { Attachment } from 'src/notification/model/email-input.dto';
import { NotificationTemplate } from 'src/notification/model/notification-template.enum';
import { PackageStatus } from 'src/package/model/package-status.enum';
import { PackageType } from 'src/package/model/package-type.enum';
import { PackageService } from 'src/package/package.service';
import { PaymentConfirmation } from 'src/payment/model/payment-confirmation';
import { PaymentMethod } from 'src/payment/model/payment-method.enum';
import { QueueType } from 'src/queue/model/queue-type.enum';

import { CollaboratorService } from '../collaborator/collaborator.service';
import { CommerceService } from '../commerce/commerce.service';
import { FeatureToggleDetailsDto } from '../feature-toggle/dto/feature-toggle-details.dto';
import { FeatureToggleService } from '../feature-toggle/feature-toggle.service';
import { FeatureToggleName } from '../feature-toggle/model/feature-toggle.enum';
import { ModuleService } from '../module/module.service';
import { NotificationType } from '../notification/model/notification-type.enum';
import { NotificationService } from '../notification/notification.service';
import { QueueService } from '../queue/queue.service';
import { ServiceService } from '../service/service.service';
import { GcpLoggerService } from '../shared/logger/gcp-logger.service';
import { AuditLogService } from '../shared/services/audit-log.service';
import { ConsentOrchestrationService } from '../shared/services/consent-orchestration.service';
import { ConsentTriggersService } from '../shared/services/consent-triggers.service';
import { ConsentRequestTiming } from '../shared/model/consent-requirement.entity';
import TermsAccepted from '../shared/events/TermsAccepted';
import { DateModel } from '../shared/utils/date.model';
import { TelemedicineService } from '../telemedicine/telemedicine.service';
import { PersonalInfo, User } from '../user/model/user.entity';
import { UserService } from '../user/user.service';

import { AttentionDefaultBuilder } from './builders/attention-default';
import { AttentionNoDeviceBuilder } from './builders/attention-no-device';
import { AttentionReserveBuilder } from './builders/attention-reserve';
import { AttentionSurveyBuilder } from './builders/attention-survey';
import { AttentionTelemedicineBuilder } from './builders/attention-telemedicine';
import { AttentionDetailsDto } from './dto/attention-details.dto';
import AttentionStageChanged from './events/AttentionStageChanged';
import AttentionUpdated from './events/AttentionUpdated';
import { AttentionChannel } from './model/attention-channel.enum';
import { AttentionStage } from './model/attention-stage.enum';
import { AttentionStageHistory } from './model/attention-stage-history.entity';
import { AttentionStatus } from './model/attention-status.enum';
import { AttentionType } from './model/attention-type.enum';
import { Attention, Block } from './model/attention.entity';
import * as NOTIFICATIONS from './notifications/notifications.js';

@Injectable()
export class AttentionService {
  constructor(
    @InjectRepository(Attention)
    private attentionRepository = getRepository(Attention),
    private queueService: QueueService,
    private collaboratorService: CollaboratorService,
    private notificationService: NotificationService,
    private userService: UserService,
    private moduleService: ModuleService,
    private featureToggleService: FeatureToggleService,
    private attentionDefaultBuilder: AttentionDefaultBuilder,
    private attentionSurveyBuilder: AttentionSurveyBuilder,
    private attentionNoDeviceBuilder: AttentionNoDeviceBuilder,
    private attentionReserveBuilder: AttentionReserveBuilder,
    private attentionTelemedicineBuilder: AttentionTelemedicineBuilder,
    private commerceService: CommerceService,
    @Inject(forwardRef(() => PackageService))
    private packageService: PackageService,
    private incomeService: IncomeService,
    private serviceService: ServiceService,
    private documentsService: DocumentsService,
    @Inject(forwardRef(() => TelemedicineService))
    private telemedicineService: TelemedicineService,
    @Inject(GcpLoggerService)
    private readonly logger: GcpLoggerService,
    @Inject(forwardRef(() => ConsentOrchestrationService))
    private consentOrchestrationService?: ConsentOrchestrationService,
    @Optional() @Inject(forwardRef(() => ConsentTriggersService))
    private consentTriggersService?: ConsentTriggersService
  ) {
    this.logger.setContext('AttentionService');
  }

  public async getAttentionById(id: string): Promise<Attention> {
    return await this.attentionRepository.findById(id);
  }

  private async hasIncomeForAttention(attentionId: string): Promise<boolean> {
    try {
      const incomes = await this.incomeService.getIncomesByAttentionId(attentionId);
      return incomes && incomes.length > 0;
    } catch (error) {
      // If there's an error checking, assume no income exists to avoid duplicates
      this.logger.warn(`Error checking income for attention ${attentionId}: ${error.message}`);
      return false;
    }
  }

  public async getAttentionDetails(
    id: string,
    collaboratorId?: string
  ): Promise<AttentionDetailsDto> {
    try {
      const attention = await this.getAttentionById(id);

      // Optional: Validate collaborator access to commerce if collaboratorId is provided
      if (collaboratorId) {
        try {
          const collaborator = await this.collaboratorService.getCollaboratorById(collaboratorId);
          if (collaborator) {
            // Check if collaborator has access to the attention's commerce
            const hasAccess =
              collaborator.commerceId === attention.commerceId ||
              (collaborator.commercesId && collaborator.commercesId.includes(attention.commerceId));

            if (!hasAccess) {
              throw new HttpException(
                'No tiene acceso a esta atención',
                HttpStatus.FORBIDDEN
              );
            }
          }
        } catch (error) {
          // If collaborator validation fails, throw appropriate error
          if (error instanceof HttpException) {
            throw error;
          }
          // If collaborator not found, log but don't block (for backward compatibility)
          this.logger.log(
            `[AttentionService] Could not validate collaborator access: ${error.message}`
          );
        }
      }

      const attentionDetailsDto: AttentionDetailsDto = new AttentionDetailsDto();
      attentionDetailsDto.id = attention.id;
      attentionDetailsDto.commerceId = attention.commerceId;
      attentionDetailsDto.collaboratorId = attention.collaboratorId;
      attentionDetailsDto.createdAt = attention.createdAt;
      attentionDetailsDto.endAt = attention.endAt;
      attentionDetailsDto.number = attention.number;
      attentionDetailsDto.queueId = attention.queueId;
      attentionDetailsDto.status = attention.status;
      attentionDetailsDto.userId = attention.userId;
      attentionDetailsDto.moduleId = attention.moduleId;
      attentionDetailsDto.comment = attention.comment;
      attentionDetailsDto.surveyId = attention.surveyId;
      attentionDetailsDto.reactivatedAt = attention.reactivatedAt;
      attentionDetailsDto.reactivated = attention.reactivated;
      attentionDetailsDto.duration = attention.duration;
      attentionDetailsDto.type = attention.type;
      attentionDetailsDto.assistingCollaboratorId = attention.assistingCollaboratorId;
      attentionDetailsDto.channel = attention.channel;
      attentionDetailsDto.block = attention.block;
      attentionDetailsDto.paid = attention.paid;
      attentionDetailsDto.paidAt = attention.paidAt;
      attentionDetailsDto.paymentConfirmationData = attention.paymentConfirmationData;
      attentionDetailsDto.serviceId = attention.serviceId;
      attentionDetailsDto.servicesId = attention.servicesId;
      attentionDetailsDto.servicesDetails = attention.servicesDetails;
      attentionDetailsDto.clientId = attention.clientId;
      attentionDetailsDto.surveyPostAttentionDateScheduled =
        attention.surveyPostAttentionDateScheduled;
      attentionDetailsDto.processedAt = attention.processedAt;
      attentionDetailsDto.telemedicineSessionId = attention.telemedicineSessionId;
      attentionDetailsDto.telemedicineConfig = attention.telemedicineConfig;
      attentionDetailsDto.telemedicineInfo = attention.telemedicineInfo;
      attentionDetailsDto.currentStage = attention.currentStage;
      attentionDetailsDto.stageHistory = attention.stageHistory;
      if (attention.queueId) {
        attentionDetailsDto.queue = await this.queueService.getQueueById(attention.queueId);
        attentionDetailsDto.commerce = await this.commerceService.getCommerceById(
          attentionDetailsDto.queue.commerceId
        );
        delete attentionDetailsDto.commerce.queues;
      }
      if (attention.userId !== undefined) {
        attentionDetailsDto.user = await this.userService.getUserById(attention.userId);
      }
      if (attention.collaboratorId !== undefined) {
        attentionDetailsDto.collaborator = await this.collaboratorService.getCollaboratorById(
          attention.collaboratorId
        );
      }
      if (attention.moduleId !== undefined) {
        attentionDetailsDto.module = await this.moduleService.getModuleById(attention.moduleId);
      }
      return attentionDetailsDto;
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al obtener detalles de la atenci?n`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async getAttentionUserDetails(id: string): Promise<AttentionDetailsDto> {
    try {
      const attention = await this.getAttentionById(id);
      const attentionDetailsDto: AttentionDetailsDto = new AttentionDetailsDto();
      attentionDetailsDto.id = attention.id;
      attentionDetailsDto.commerceId = attention.commerceId;
      attentionDetailsDto.collaboratorId = attention.collaboratorId;
      attentionDetailsDto.createdAt = attention.createdAt;
      attentionDetailsDto.endAt = attention.endAt;
      attentionDetailsDto.number = attention.number;
      attentionDetailsDto.queueId = attention.queueId;
      attentionDetailsDto.status = attention.status;
      attentionDetailsDto.userId = attention.userId;
      attentionDetailsDto.moduleId = attention.moduleId;
      attentionDetailsDto.comment = attention.comment;
      attentionDetailsDto.surveyId = attention.surveyId;
      attentionDetailsDto.reactivatedAt = attention.reactivatedAt;
      attentionDetailsDto.reactivated = attention.reactivated;
      attentionDetailsDto.duration = attention.duration;
      attentionDetailsDto.type = attention.type;
      attentionDetailsDto.assistingCollaboratorId = attention.assistingCollaboratorId;
      attentionDetailsDto.channel = attention.channel;
      attentionDetailsDto.notificationOn = attention.notificationOn;
      attentionDetailsDto.notificationEmailOn = attention.notificationEmailOn;
      attentionDetailsDto.block = attention.block;
      attentionDetailsDto.paid = attention.paid;
      attentionDetailsDto.paidAt = attention.paidAt;
      attentionDetailsDto.paymentConfirmationData = attention.paymentConfirmationData;
      attentionDetailsDto.serviceId = attention.serviceId;
      attentionDetailsDto.servicesId = attention.servicesId;
      attentionDetailsDto.servicesDetails = attention.servicesDetails;
      attentionDetailsDto.clientId = attention.clientId;
      attentionDetailsDto.surveyPostAttentionDateScheduled =
        attention.surveyPostAttentionDateScheduled;
      attentionDetailsDto.processedAt = attention.processedAt;
      // Include currentStage and stageHistory for consistency with getAttentionDetails
      attentionDetailsDto.currentStage = attention.currentStage;
      attentionDetailsDto.stageHistory = attention.stageHistory;
      if (attention.userId !== undefined) {
        attentionDetailsDto.user = await this.userService.getUserById(attention.userId);
      }
      return attentionDetailsDto;
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al obtener detalles de la atenci?n`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async getAttentionDetailsByNumber(
    number: number,
    status: AttentionStatus,
    queueId: string
  ): Promise<AttentionDetailsDto> {
    const attention = await this.getAttentionByNumber(+number, status, queueId);
    if (attention.length > 0) {
      return await this.getAttentionDetails(attention[0].id);
    }
  }

  public async getAvailableAttentionDetailsByNumber(
    number: number,
    queueId: string
  ): Promise<AttentionDetailsDto> {
    const attention = await this.getAvailableAttentionByNumber(+number, queueId);
    if (attention.length > 0) {
      return await this.getAttentionDetails(attention[0].id);
    }
  }

  public async getNextAvailableAttentionDetails(queueId: string): Promise<AttentionDetailsDto> {
    const attention = await this.getAvailableAttentiosnByQueue(queueId);
    if (attention.length > 0) {
      return await this.getAttentionDetails(attention[0].id);
    }
  }

  public async getAttentionDetailsByQueueAndStatuses(
    status: AttentionStatus,
    queueId: string
  ): Promise<AttentionDetailsDto[]> {
    const result = [];
    const attentions = await this.getAttentionByQueueAndStatus(status, queueId);
    if (attentions.length > 0) {
      for (let i = 0; i < attentions.length; i++) {
        const attention = await this.getAttentionUserDetails(attentions[i].id);
        result.push(attention);
      }
    }
    return result;
  }

  public async getAvailableAttentionDetailsByQueues(
    queueId: string
  ): Promise<AttentionDetailsDto[]> {
    const result = [];
    const attentions = await this.getAvailableAttentiosnByQueue(queueId);
    if (attentions.length > 0) {
      for (let i = 0; i < attentions.length; i++) {
        const attention = await this.getAttentionUserDetails(attentions[i].id);
        result.push(attention);
      }
    }
    return result;
  }

  public async getAttentionByNumber(
    number: number,
    status: AttentionStatus,
    queueId: string
  ): Promise<Attention[]> {
    return await this.attentionRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('number', number)
      .whereEqualTo('status', status)
      .orderByDescending('createdAt')
      .find();
  }

  public async getAvailableAttentionByNumber(
    number: number,
    queueId: string
  ): Promise<Attention[]> {
    return await this.attentionRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('number', number)
      .whereIn('status', [AttentionStatus.USER_CANCELLED, AttentionStatus.PENDING])
      .orderByDescending('createdAt')
      .find();
  }

  public async getProcessingAttentionsByQueue(queueId: string): Promise<Attention[]> {
    return await this.attentionRepository
      .whereEqualTo('queueId', queueId)
      .whereIn('status', [AttentionStatus.REACTIVATED, AttentionStatus.PROCESSING])
      .orderByDescending('createdAt')
      .find();
  }

  public async getProcessingAttentionDetailsByQueue(
    queueId: string
  ): Promise<AttentionDetailsDto[]> {
    const result = [];
    const attentions = await this.getProcessingAttentionsByQueue(queueId);
    if (attentions.length > 0) {
      for (let i = 0; i < attentions.length; i++) {
        const attention = await this.getAttentionUserDetails(attentions[i].id);
        result.push(attention);
      }
    }
    return result;
  }

  public async getAttentionByNumberAndDate(
    number: number,
    status: AttentionStatus,
    queueId: string,
    date: Date
  ): Promise<Attention[]> {
    const startDate = date.toISOString().slice(0, 10);
    const dateValue = new Date(startDate);
    return await this.attentionRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('number', number)
      .whereEqualTo('status', status)
      .whereGreaterOrEqualThan('createdAt', dateValue)
      .orderByDescending('createdAt')
      .find();
  }

  public async getAttentionByDate(queueId: string, date: Date): Promise<Attention[]> {
    const startDate = new Date(date).toISOString().slice(0, 10);
    const dateValue = new Date(startDate);
    return await this.attentionRepository
      .whereEqualTo('queueId', queueId)
      .whereGreaterOrEqualThan('createdAt', dateValue)
      .orderByDescending('createdAt')
      .find();
  }

  public async getAttentionByQueue(status: AttentionStatus, queueId: string): Promise<Attention[]> {
    return await this.attentionRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('status', status)
      .orderByAscending('createdAt')
      .find();
  }

  public async getAttentionByQueueAndStatus(
    status: AttentionStatus,
    queueId: string
  ): Promise<Attention[]> {
    return await this.attentionRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('status', status)
      .orderByAscending('createdAt')
      .find();
  }

  public async getAvailableAttentiosnByQueue(queueId: string): Promise<Attention[]> {
    return await this.attentionRepository
      .whereEqualTo('queueId', queueId)
      .whereIn('status', [AttentionStatus.PENDING])
      .orderByAscending('number')
      .find();
  }

  public async getPendingCommerceAttentions(commerceId: string): Promise<Attention[]> {
    return await this.attentionRepository
      .whereEqualTo('commerceId', commerceId)
      .whereIn('status', [AttentionStatus.PENDING])
      .find();
  }

  public async getPostAttentionScheduledSurveys(date: string, limit = 100): Promise<Attention[]> {
    return await this.attentionRepository
      .whereEqualTo('surveyPostAttentionDateScheduled', date)
      .whereIn('status', [AttentionStatus.TERMINATED])
      .whereEqualTo('notificationSurveySent', false)
      .limit(limit)
      .find();
  }

  public async createAttention(
    queueId: string,
    collaboratorId?: string,
    channel: string = AttentionChannel.QR,
    userIn?: User,
    type?: AttentionType,
    block?: Block,
    date?: Date,
    paymentConfirmationData?: PaymentConfirmation,
    bookingId?: string,
    servicesId?: string[],
    servicesDetails?: object[],
    clientId?: string,
    termsConditionsToAcceptCode?: string,
    termsConditionsAcceptedCode?: string,
    termsConditionsToAcceptedAt?: Date,
    telemedicineConfig?: {
      type: any;
      scheduledAt: Date | string;
      recordingEnabled?: boolean;
      notes?: string;
    }
  ): Promise<Attention> {
    try {
      let attentionCreated;
      const queue = await this.queueService.getQueueById(queueId);
      if (
        userIn &&
        (userIn.acceptTermsAndConditions === false || !userIn.acceptTermsAndConditions)
      ) {
        throw new HttpException(
          `No ha aceptado los terminos y condiciones`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      const newUser = userIn ? userIn : new User();
      const user = await this.userService.createUser(
        newUser.name,
        newUser.phone,
        newUser.email,
        queue.commerceId,
        queue.id,
        newUser.lastName,
        newUser.idNumber,
        newUser.notificationOn,
        newUser.notificationEmailOn,
        newUser.personalInfo,
        clientId,
        newUser.acceptTermsAndConditions
      );
      clientId = clientId ? clientId : user.clientId;
      const userId = user.id;

      // Trigger BEFORE_SERVICE consent request
      if (this.consentTriggersService && clientId && queue.commerceId) {
        try {
          await this.consentTriggersService.triggerBeforeService(
            queue.commerceId,
            clientId,
            servicesId?.[0] || 'unknown'
          );
        } catch (error) {
          // Log error but don't fail attention creation
          this.logger.warn(`Error triggering BEFORE_SERVICE consent: ${error.message}`);
        }
      }

      const onlySurvey = await this.featureToggleService.getFeatureToggleByNameAndCommerceId(
        queue.commerceId,
        'only-survey'
      );

      // Handle TELEMEDICINE type - similar to bookings: if telemedicineConfig is provided, set type to TELEMEDICINE
      // Also handle explicit TELEMEDICINE type
      const isTelemedicine = (type && type === AttentionType.TELEMEDICINE) || !!telemedicineConfig;

      if (isTelemedicine) {
        if (!telemedicineConfig) {
          throw new HttpException(
            'Telemedicine configuration is required for TELEMEDICINE attention type',
            HttpStatus.BAD_REQUEST
          );
        }
        // Convert scheduledAt to Date if it's a string
        const scheduledAtDate =
          telemedicineConfig.scheduledAt instanceof Date
            ? telemedicineConfig.scheduledAt
            : new Date(telemedicineConfig.scheduledAt);

        attentionCreated = await this.attentionTelemedicineBuilder.create(
          queue,
          collaboratorId,
          channel,
          userId,
          date,
          servicesId,
          servicesDetails,
          clientId,
          {
            type: telemedicineConfig.type as any,
            scheduledAt: scheduledAtDate,
            recordingEnabled: telemedicineConfig.recordingEnabled,
            notes: telemedicineConfig.notes,
          }
        );
      } else if (type && type === AttentionType.NODEVICE) {
        if (block && block.number) {
          attentionCreated = await this.attentionReserveBuilder.create(
            queue,
            collaboratorId,
            type,
            channel,
            userId,
            block,
            date,
            paymentConfirmationData,
            bookingId,
            servicesId,
            servicesDetails,
            clientId,
            termsConditionsToAcceptCode,
            termsConditionsAcceptedCode,
            termsConditionsToAcceptedAt
          );
        } else {
          attentionCreated = await this.attentionNoDeviceBuilder.create(
            queue,
            collaboratorId,
            channel,
            userId,
            date,
            servicesId,
            servicesDetails,
            clientId
          );
        }
      } else if (onlySurvey) {
        if (onlySurvey.active) {
          const collaboratorBot = await this.collaboratorService.getCollaboratorBot(
            queue.commerceId
          );
          if (!collaboratorBot || collaboratorBot === undefined) {
            throw new HttpException(
              `Colaborador Bot no existe, debe crearse`,
              HttpStatus.INTERNAL_SERVER_ERROR
            );
          }
          const attentionBuild = await this.attentionSurveyBuilder.create(
            queue,
            collaboratorBot.id,
            channel,
            userId,
            date,
            servicesId,
            servicesDetails,
            clientId
          );
          attentionCreated = await this.finishAttention(
            attentionBuild.userId,
            attentionBuild.id,
            ''
          );
        } else {
          attentionCreated = await this.attentionDefaultBuilder.create(
            queue,
            collaboratorId,
            channel,
            userId,
            date,
            servicesId,
            servicesDetails,
            clientId
          );
        }
      } else if (block && block.number) {
        attentionCreated = await this.attentionReserveBuilder.create(
          queue,
          collaboratorId,
          AttentionType.STANDARD,
          channel,
          userId,
          block,
          date,
          paymentConfirmationData,
          bookingId,
          servicesId,
          servicesDetails,
          clientId,
          termsConditionsToAcceptCode,
          termsConditionsAcceptedCode,
          termsConditionsToAcceptedAt
        );
      } else {
        attentionCreated = await this.attentionDefaultBuilder.create(
          queue,
          collaboratorId,
          channel,
          userId,
          date,
          servicesId,
          servicesDetails,
          clientId
        );
      }
      // Update attention with user name for easy access in Firebase
      if (user && (user.name || user.lastName)) {
        attentionCreated.userName = user.name;
        attentionCreated.userLastName = user.lastName;
        const attentionUpdated = await this.attentionRepository.update(attentionCreated);
        // Publish update event to sync userName/userLastName to Firebase
        const attentionUpdatedEvent = new AttentionUpdated(new Date(), attentionUpdated, {
          user: 'system',
        });
        publish(attentionUpdatedEvent);
        attentionCreated = attentionUpdated;
      }

      if (user.email !== undefined) {
        await this.attentionEmail(attentionCreated.id);
      }
      this.logger.info('Attention created successfully', {
        attentionId: attentionCreated.id,
        queueId,
        commerceId: queue.commerceId,
        collaboratorId,
        userId,
        clientId,
        type: attentionCreated.type,
        status: attentionCreated.status,
        hasBooking: !!bookingId,
        hasPayment: !!paymentConfirmationData,
      });

      // Hook: Solicitar consentimientos pendientes automáticamente
      if (
        this.consentOrchestrationService &&
        clientId &&
        queue.commerceId
      ) {
        try {
          // Verificar si es la primera atención del cliente
          const existingAttentions = await this.attentionRepository
            .whereEqualTo('commerceId', queue.commerceId)
            .whereEqualTo('clientId', clientId)
            .whereNotEqualTo('id', attentionCreated.id)
            .find();

          const isFirstAttention = existingAttentions.length === 0;
          const timing = isFirstAttention
            ? ConsentRequestTiming.FIRST_ATTENTION
            : ConsentRequestTiming.CHECK_IN;

          const requestedBy = collaboratorId || userId || 'system';
          await this.consentOrchestrationService.requestAllPendingConsents(
            queue.commerceId,
            clientId,
            timing,
            requestedBy
          );
          this.logger.log(
            `[AttentionService] Consent request sent for attention ${attentionCreated.id} (timing: ${timing})`
          );
        } catch (error) {
          this.logger.error(
            `[AttentionService] Failed to request consents for attention ${attentionCreated.id}: ${error.message}`,
            error.stack
          );
          // Don't throw - consent request failure shouldn't break attention creation
        }
      }

      return attentionCreated;
    } catch (error) {
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        queueId,
        collaboratorId,
        channel,
        hasUser: !!userIn,
        hasBooking: !!bookingId,
        operation: 'createAttention',
      });
      throw new HttpException(
        `Hubo un problema al crear la atenci?n: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async saveDataNotification(
    user: string,
    attentionId: string,
    name?: string,
    phone?: string,
    email?: string,
    commerceId?: string,
    queueId?: string,
    lastName?: string,
    idNumber?: string,
    notificationOn?: boolean,
    notificationEmailOn?: boolean,
    personalInfo?: PersonalInfo
  ): Promise<Attention> {
    const attention = await this.getAttentionById(attentionId);
    let userToNotify = undefined;
    if (attention.userId !== undefined) {
      userToNotify = await this.userService.updateUser(
        name,
        attention.userId,
        name,
        phone,
        email,
        commerceId,
        queueId,
        lastName,
        idNumber,
        notificationOn,
        notificationEmailOn,
        personalInfo
      );
    } else {
      userToNotify = await this.userService.createUser(
        name,
        phone,
        email,
        commerceId,
        queueId,
        lastName,
        idNumber,
        notificationOn,
        notificationEmailOn,
        personalInfo
      );
      attention.userId = userToNotify.id;
      attention.clientId = attention.clientId || userToNotify.clientId;
    }
    if (phone !== undefined) {
      attention.notificationOn = true;
    }
    if (email !== undefined) {
      attention.notificationEmailOn = true;
    }
    const attentionUpdated = await this.update(user, attention);
    if (email !== undefined) {
      await this.attentionEmail(attentionUpdated.id);
    }
    attentionUpdated.user = userToNotify;
    return attentionUpdated;
  }

  public async update(user: string, attention: Attention): Promise<Attention> {
    const attentionUpdated = await this.attentionRepository.update(attention);
    const attentionUpdatedEvent = new AttentionUpdated(new Date(), attentionUpdated, { user });
    this.logger.log(`[AttentionService] Publishing AttentionUpdated event for attention ${attentionUpdated.id} with status ${attentionUpdated.status}`);
    publish(attentionUpdatedEvent);
    return attentionUpdated;
  }

  /**
   * Track that a collaborator is accessing/managing an attention
   * This is optional tracking and does not change status or stage
   * Only updates assistingCollaboratorId for tracking purposes
   */
  public async trackAttentionAccess(
    user: string,
    attentionId: string,
    collaboratorId: string
  ): Promise<Attention> {
    const attention = await this.getAttentionById(attentionId);
    // Only update assistingCollaboratorId, do not change status or stage
    attention.assistingCollaboratorId = collaboratorId;
    // Use update method to trigger events and logging
    return await this.update(user, attention);
  }

  /**
   * Advance an attention to a new stage
   * Requires feature flag 'attention-stages-enabled' to be active
   *
   * Validates:
   * - Attention exists
   * - Attention is not cancelled
   * - Feature flag is enabled
   * - Stage transition is valid (TODO: implement transition validation)
   * - User is valid (TODO: implement user validation)
   */
  public async advanceStage(
    user: string,
    attentionId: string,
    newStage: AttentionStage,
    notes?: string,
    collaboratorId?: string
  ): Promise<Attention> {
    try {
      // Validate user
      if (!user || typeof user !== 'string' || user.trim().length === 0) {
        throw new HttpException('Usuario inválido', HttpStatus.BAD_REQUEST);
      }

      // Validate stage
      if (!newStage || !Object.values(AttentionStage).includes(newStage)) {
        throw new HttpException(`Etapa inválida: ${newStage}`, HttpStatus.BAD_REQUEST);
      }

      // Get attention
      const attention = await this.getAttentionById(attentionId);
      if (!attention || !attention.id) {
        throw new HttpException(`Atenci?n no existe: ${attentionId}`, HttpStatus.NOT_FOUND);
      }

      // Check if attention is cancelled FIRST (before any other validations)
      // This is more efficient and provides clearer error messages
      if (attention.cancelled || attention.status === AttentionStatus.CANCELLED) {
        throw new HttpException(
          `No se puede avanzar etapa de una atenci?n cancelada: ${attentionId}`,
          HttpStatus.BAD_REQUEST
        );
      }

      // Get commerce to check feature flag
      const commerce = await this.commerceService.getCommerceDetails(attention.commerceId);
      if (!commerce || !commerce.features) {
        throw new HttpException(
          `Feature flag no disponible para comercio: ${attention.commerceId}`,
          HttpStatus.BAD_REQUEST
        );
      }

      // Check feature flag
      const isStagesEnabled = this.featureToggleIsActive(
        commerce.features,
        'attention-stages-enabled'
      );
      if (!isStagesEnabled) {
        throw new HttpException(
          `Sistema de etapas no est? habilitado para este comercio`,
          HttpStatus.BAD_REQUEST
        );
      }

      // Validar consentimientos bloqueantes antes de avanzar etapa
      if (this.consentTriggersService && attention.clientId && attention.commerceId) {
        const blockingCheck = await this.consentTriggersService.checkBlockingConsents(
          attention.clientId,
          attention.commerceId
        );
        if (blockingCheck.blocked) {
          throw new HttpException(
            `No se puede avanzar etapa: faltan consentimientos obligatorios: ${blockingCheck.missingConsents.join(', ')}`,
            HttpStatus.PRECONDITION_FAILED
          );
        }
      }

      // Initialize stage history if it doesn't exist
      if (!attention.stageHistory) {
        attention.stageHistory = [];
      }

      // Get current stage (if exists)
      const previousStage = attention.currentStage;

      // TODO: Validate stage transition
      // Should validate that newStage is a valid next stage from previousStage
      // Example: Cannot go from CHECK_IN directly to TERMINATED
      // This validation should be configurable per commerce
      // For now, we allow any transition (to be implemented in future)

      // Use collaboratorId if provided, otherwise fallback to user (for backward compatibility)
      const collaboratorIdToUse = collaboratorId || user;

      // If there's a current stage, close it in history
      if (previousStage) {
        const currentHistoryEntry = attention.stageHistory.find(
          entry => entry.stage === previousStage && !entry.exitedAt
        );
        if (currentHistoryEntry) {
          currentHistoryEntry.exitedAt = new Date();
          currentHistoryEntry.exitedBy = collaboratorIdToUse; // Track which collaborator exited the stage
          // Calculate duration
          if (currentHistoryEntry.enteredAt) {
            const durationMs =
              currentHistoryEntry.exitedAt.getTime() - currentHistoryEntry.enteredAt.getTime();
            currentHistoryEntry.duration = durationMs / (1000 * 60); // Convert to minutes
          }
        }
      }

      // Create new history entry for the new stage
      const newHistoryEntry: AttentionStageHistory = {
        stage: newStage,
        enteredAt: new Date(),
        enteredBy: collaboratorIdToUse, // Track which collaborator entered the stage
        notes: notes,
      };
      attention.stageHistory.push(newHistoryEntry);

      // Update current stage
      attention.currentStage = newStage;

      // If advancing to TERMINATED, also update status
      if (newStage === AttentionStage.TERMINATED) {
        attention.status = AttentionStatus.TERMINATED;
        if (!attention.endAt) {
          attention.endAt = new Date();
        }
      }

      // Update attention
      const attentionUpdated = await this.update(user, attention);

      // Publish stage changed event
      // Get the new history entry to include timing information
      const updatedNewHistoryEntry = attentionUpdated.stageHistory?.find(
        entry => entry.stage === newStage && entry.enteredAt
      );
      const updatedPreviousHistoryEntry = previousStage
        ? attentionUpdated.stageHistory?.find(
            entry => entry.stage === previousStage && entry.exitedAt
          )
        : null;

      const stageChangedEvent = new AttentionStageChanged(
        new Date(),
        {
          attentionId: attentionUpdated.id,
          commerceId: attentionUpdated.commerceId,
          queueId: attentionUpdated.queueId,
          previousStage: previousStage || null,
          newStage: newStage,
          changedBy: user,
          notes: notes,
          enteredAt: updatedNewHistoryEntry?.enteredAt || new Date(),
          previousStageExitedAt: updatedPreviousHistoryEntry?.exitedAt || null,
          previousStageDuration: updatedPreviousHistoryEntry?.duration || null,
        },
        { user }
      );
      publish(stageChangedEvent);

      this.logger.info('Attention stage advanced', {
        attentionId: attentionUpdated.id,
        previousStage,
        newStage,
        user,
        commerceId: attention.commerceId,
      });

      return attentionUpdated;
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        undefined,
        {
          attentionId,
          newStage,
          user,
          operation: 'advanceStage',
        }
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Hubo un problema al avanzar la etapa: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get attentions by stage for a specific queue
   * Optionally filter by date
   */
  public async getAttentionsByStage(
    commerceId: string,
    queueId: string,
    stage: AttentionStage,
    date?: Date
  ): Promise<Attention[]> {
    try {
      // Validate parameters
      if (!commerceId || typeof commerceId !== 'string' || commerceId.trim().length === 0) {
        throw new HttpException('commerceId es requerido', HttpStatus.BAD_REQUEST);
      }

      if (!queueId || typeof queueId !== 'string' || queueId.trim().length === 0) {
        throw new HttpException('queueId es requerido', HttpStatus.BAD_REQUEST);
      }

      if (!stage || !Object.values(AttentionStage).includes(stage)) {
        throw new HttpException(`Etapa inválida: ${stage}`, HttpStatus.BAD_REQUEST);
      }

      let query = this.attentionRepository
        .whereEqualTo('commerceId', commerceId)
        .whereEqualTo('queueId', queueId)
        .whereEqualTo('currentStage', stage);

      // If date is provided, filter by date
      if (date) {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        query = query.whereGreaterOrEqualThan('createdAt', startDate);
      }

      return await query.orderByAscending('createdAt').find();
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        undefined,
        {
          commerceId,
          queueId,
          stage,
          date,
          operation: 'getAttentionsByStage',
        }
      );
      throw new HttpException(
        `Hubo un problema al obtener atenciones por etapa: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async attend(
    user: string,
    number: number,
    queueId: string,
    collaboratorId: string,
    commerceLanguage: string,
    _notify?: boolean
  ) {
    let attention = (await this.getAvailableAttentionByNumber(number, queueId))[0];
    if (attention) {
      const queue = await this.queueService.getQueueById(attention.queueId);
      try {
        if (attention.status === AttentionStatus.PENDING) {
          // Validar consentimientos bloqueantes antes de avanzar a PROCESSING
          if (this.consentTriggersService && attention.clientId && attention.commerceId) {
            const blockingCheck = await this.consentTriggersService.checkBlockingConsents(
              attention.clientId,
              attention.commerceId
            );
            if (blockingCheck.blocked) {
              throw new HttpException(
                `No se puede atender la atención: faltan consentimientos obligatorios: ${blockingCheck.missingConsents.join(', ')}`,
                HttpStatus.PRECONDITION_FAILED
              );
            }
          }

          const collaborator = await this.collaboratorService.getCollaboratorById(collaboratorId);
          attention.collaboratorId = collaborator.id;
          attention.moduleId = collaborator.moduleId;
          attention.status = AttentionStatus.PROCESSING;
          attention.processedAt = new Date();
          queue.currentAttentionNumber = queue.currentAttentionNumber + 1;
          const currentAttention = (
            await this.getAvailableAttentionByNumber(queue.currentAttentionNumber, queue.id)
          )[0];
          if (currentAttention) {
            queue.currentAttentionId = currentAttention.id;
          } else {
            queue.currentAttentionId = '';
          }
          await this.queueService.updateQueue(user, queue);

          await this.notify(attention.id, collaborator.moduleId, commerceLanguage);
          attention = await this.update(user, attention);
          await this.notifyEmail(attention.id, collaborator.moduleId, commerceLanguage);
          this.logger.info('Attention started (attended)', {
            attentionId: attention.id,
            queueId,
            collaboratorId,
            number,
            commerceId: attention.commerceId,
            userId: attention.userId,
            user,
          });
        } else if (attention.status === AttentionStatus.USER_CANCELLED) {
          attention = await this.finishCancelledAttention(user, attention.id);
        }
        return attention;
      } catch (error) {
        this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
          number,
          queueId,
          collaboratorId,
          commerceLanguage,
          operation: 'attend',
        });
        throw new HttpException(
          `Hubo un problema al procesar la atenci?n: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  }

  public async skip(user: string, number: number, queueId: string, collaboratorId: string) {
    const attention = (
      await this.getAttentionByNumber(number, AttentionStatus.PROCESSING, queueId)
    )[0];
    if (!attention) {
      throw new HttpException(
        `Atencion que se quiere saltar no existe o ya fue saltada antes: ${attention.id}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    const collaborator = await this.collaboratorService.getCollaboratorById(collaboratorId);
    const queue = await this.queueService.getQueueById(attention.queueId);
    if (
      attention.status === AttentionStatus.PROCESSING ||
      attention.status === AttentionStatus.REACTIVATED
    ) {
      attention.status = AttentionStatus.SKIPED;
      attention.collaboratorId = collaborator.id;
      const currentAttention = (
        await this.getAttentionByNumber(
          queue.currentAttentionNumber,
          AttentionStatus.PENDING,
          queue.id
        )
      )[0];
      if (currentAttention && currentAttention.id !== undefined) {
        queue.currentAttentionId = currentAttention.id;
      } else {
        queue.currentAttentionId = '';
      }
      await this.queueService.updateQueue(user, queue);
      await this.update(user, attention);
    } else {
      throw new HttpException(
        `Hubo un problema, esta atenci?n no puede ser saltada: ${attention.id}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return attention;
  }

  public async reactivate(user: string, number: number, queueId: string, collaboratorId: string) {
    try {
      const attention = (
        await this.getAttentionByNumberAndDate(number, AttentionStatus.SKIPED, queueId, new Date())
      )[0];
      const collaborator = await this.collaboratorService.getCollaboratorById(collaboratorId);
      attention.status = AttentionStatus.REACTIVATED;
      attention.collaboratorId = collaborator.id;
      attention.reactivated = true;
      attention.reactivatedAt = new Date();
      const result = await this.update(user, attention);
      return result;
    } catch (error) {
      throw new HttpException(
        `Hubo un problema esta atenci?n no est? saltada: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async finishAttention(
    user: string,
    attentionId: string,
    comment: string,
    date?: Date,
    skipCheckout?: boolean
  ): Promise<Attention> {
    const attention = await this.getAttentionById(attentionId);
    if (
      attention.status === AttentionStatus.PROCESSING ||
      attention.status === AttentionStatus.REACTIVATED
    ) {
      // Get commerce to check feature flags
      const attentionCommerce = await this.commerceService.getCommerceDetails(attention.commerceId);

      // Check if stages and checkout are enabled
      const isStagesEnabled = attentionCommerce?.features
        ? this.featureToggleIsActive(attentionCommerce.features, 'attention-stages-enabled')
        : false;
      const isCheckoutEnabled = attentionCommerce?.features
        ? this.featureToggleIsActive(attentionCommerce.features, 'attention-checkout-enabled')
        : false;

      // If stages and checkout are enabled, and not skipping checkout, advance to CHECKOUT
      if (isStagesEnabled && isCheckoutEnabled && !skipCheckout) {
        // Use advanceStage to move to CHECKOUT stage
        // This will handle stage history, events, etc.
        return await this.advanceStage(
          user,
          attentionId,
          AttentionStage.CHECKOUT,
          comment
        );
      }

      // Otherwise, terminate directly (backward compatibility)
      attention.status = AttentionStatus.TERMINATED;
      if (comment) {
        attention.comment = comment;
      }
      attention.endAt = date || new Date();
      if (!attention.reactivated) {
        let dateAt = attention.createdAt;
        if (attention.processedAt !== undefined) {
          dateAt = attention.processedAt;
        }
        const diff = attention.endAt.getTime() - dateAt.getTime();
        attention.duration = diff / (1000 * 60);
      }
      const attentionDetails = await this.getAttentionDetails(attentionId);
      if (
        attentionCommerce.serviceInfo &&
        attentionCommerce.serviceInfo.surveyPostAttentionDaysAfter
      ) {
        const daysToAdd = attentionCommerce.serviceInfo.surveyPostAttentionDaysAfter || 0;
        const surveyPostAttentionDateScheduled = new DateModel().addDays(+daysToAdd).toString();
        attention.surveyPostAttentionDateScheduled = surveyPostAttentionDateScheduled;
      } else {
        this.csatEmail(attentionDetails, attentionCommerce);
        this.csatWhatsapp(attentionDetails, attentionCommerce);
      }
      this.postAttentionEmail(attentionDetails, attentionCommerce);
      const attentionFinished = await this.update(user, attention);

      // Trigger AFTER_ATTENTION consent request
      if (this.consentTriggersService && attentionFinished.clientId && attentionFinished.commerceId) {
        try {
          await this.consentTriggersService.triggerAfterAttention(
            attentionFinished.commerceId,
            attentionFinished.clientId,
            attentionFinished.id
          );
        } catch (error) {
          // Log error but don't fail attention finish
          this.logger.warn(`Error triggering AFTER_ATTENTION consent: ${error.message}`);
        }
      }

      // Consume package session if this attention is part of a package
      if (attentionFinished.packageId) {
        try {
          await this.packageService.consumeSession(
            user || 'system',
            attentionFinished.packageId,
            attentionFinished.id,
            attentionFinished.bookingId
          );
          this.logger.info('Package session consumed', {
            packageId: attentionFinished.packageId,
            attentionId: attentionFinished.id,
            user,
          });
        } catch (error) {
          // Log error but don't fail the attention finish process
          this.logger.logError(
            error instanceof Error ? error : new Error(String(error)),
            undefined,
            {
              packageId: attentionFinished.packageId,
              attentionId: attentionFinished.id,
              operation: 'consumePackageSession',
              user,
            }
          );
        }
      }

      // Automatically charge pesquisa (survey) when attention is marked as attended
      try {
        const hasIncome = await this.hasIncomeForAttention(attentionId);
        // Check if this is a survey attention (SURVEY_ONLY type or has surveyId)
        const isSurveyAttention =
          attention.type === AttentionType.SURVEY_ONLY ||
          (attention.surveyId && attention.surveyId.trim().length > 0);

        if (!hasIncome && isSurveyAttention) {
          let totalAmount = 0;

          // Try to get price from services if available
          if (attention.servicesId && attention.servicesId.length > 0) {
            const services = await this.serviceService.getServicesById(attention.servicesId);
            for (const service of services) {
              if (service && service.serviceInfo && service.serviceInfo.price) {
                totalAmount += service.serviceInfo.price;
              }
            }
          }

          // If no service price found, try to get from serviceId
          if (totalAmount === 0 && attention.serviceId) {
            const service = await this.serviceService.getServiceById(attention.serviceId);
            if (service && service.serviceInfo && service.serviceInfo.price) {
              totalAmount = service.serviceInfo.price;
            }
          }

          // Only create income if there's a price > 0
          if (totalAmount > 0) {
            await this.incomeService.createIncome(
              user || 'system',
              attention.commerceId,
              IncomeType.UNIQUE,
              IncomeStatus.CONFIRMED,
              attention.bookingId,
              attention.id,
              attention.clientId,
              attention.packageId,
              totalAmount,
              totalAmount,
              1, // installments
              PaymentMethod.OTHER, // Default payment method for automatic charges
              0, // commission
              `Cobran?a autom?tica de pesquisa - Aten??o ${attention.number}`,
              '', // fiscalNote
              '', // promotionalCode
              '', // transactionId
              '', // bankEntity
              { user: user || 'system', title: 'Pesquisa Autom?tica' } // incomeInfo
            );
            this.logger.info('Automatic income created for survey attention', {
              attentionId,
              totalAmount,
              attentionType: attention.type,
              hasSurveyId: !!attention.surveyId,
              user,
            });
          } else {
            this.logger.warn('Survey attention has no price configured', {
              attentionId,
              attentionType: attention.type,
              hasServices: !!(attention.servicesId && attention.servicesId.length > 0),
              hasServiceId: !!attention.serviceId,
            });
          }
        }
      } catch (error) {
        // Log error but don't fail the attention finish process
        this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
          attentionId,
          operation: 'createAutomaticIncome',
          user,
        });
      }

      this.logger.info('Attention finished', {
        attentionId,
        commerceId: attention.commerceId,
        queueId: attention.queueId,
        duration: attention.duration,
        hasComment: !!comment,
        hasSurveyScheduled: !!attention.surveyPostAttentionDateScheduled,
        wentToCheckout: isStagesEnabled && isCheckoutEnabled && !skipCheckout,
        user,
      });
      return attentionFinished;
    }
    return attention;
  }

  /**
   * Finish checkout and advance attention to TERMINATED stage
   * Requires attention-stages-enabled and attention-checkout-enabled feature flags
   * Attention must be in CHECKOUT stage
   */
  public async finishCheckout(
    user: string,
    attentionId: string,
    comment?: string,
    collaboratorId?: string
  ): Promise<Attention> {
    const attention = await this.getAttentionById(attentionId);

    if (!attention || !attention.id) {
      throw new HttpException(`Atención no existe: ${attentionId}`, HttpStatus.NOT_FOUND);
    }

    // Get commerce to check feature flags
    const commerce = await this.commerceService.getCommerceDetails(attention.commerceId);
    if (!commerce || !commerce.features) {
      throw new HttpException(
        `Feature flag no disponible para comercio: ${attention.commerceId}`,
        HttpStatus.BAD_REQUEST
      );
    }

    // Check if stages and checkout are enabled
    const isStagesEnabled = this.featureToggleIsActive(
      commerce.features,
      'attention-stages-enabled'
    );
    const isCheckoutEnabled = this.featureToggleIsActive(
      commerce.features,
      'attention-checkout-enabled'
    );

    if (!isStagesEnabled || !isCheckoutEnabled) {
      throw new HttpException(
        `Checkout no está habilitado para este comercio`,
        HttpStatus.BAD_REQUEST
      );
    }

    // Validate that attention is in CHECKOUT stage
    if (attention.currentStage !== AttentionStage.CHECKOUT) {
      throw new HttpException(
        `Atención no está en etapa de checkout. Etapa actual: ${attention.currentStage}`,
        HttpStatus.BAD_REQUEST
      );
    }

    // Update comment if provided
    if (comment) {
      attention.comment = comment;
    }

    // Set endAt if not already set
    if (!attention.endAt) {
      attention.endAt = new Date();
    }

    // Calculate duration if not already calculated
    if (!attention.reactivated && !attention.duration) {
      let dateAt = attention.createdAt;
      if (attention.processedAt !== undefined) {
        dateAt = attention.processedAt;
      }
      const diff = attention.endAt.getTime() - dateAt.getTime();
      attention.duration = diff / (1000 * 60);
    }

    // Get attention details for notifications
    const attentionDetails = await this.getAttentionDetails(attentionId);

    // Schedule survey or send CSAT notifications
    if (
      commerce.serviceInfo &&
      commerce.serviceInfo.surveyPostAttentionDaysAfter
    ) {
      const daysToAdd = commerce.serviceInfo.surveyPostAttentionDaysAfter || 0;
      const surveyPostAttentionDateScheduled = new DateModel().addDays(+daysToAdd).toString();
      attention.surveyPostAttentionDateScheduled = surveyPostAttentionDateScheduled;
    } else {
      this.csatEmail(attentionDetails, commerce);
      this.csatWhatsapp(attentionDetails, commerce);
    }

    // Send post-attention email
    this.postAttentionEmail(attentionDetails, commerce);

    // Advance to TERMINATED stage using advanceStage
    // This will handle stage history, events, status update, etc.
    const attentionFinished = await this.advanceStage(
      user,
      attentionId,
      AttentionStage.TERMINATED,
      comment,
      collaboratorId
    );

    // Update status to TERMINATED (advanceStage should handle this, but ensure it)
    attentionFinished.status = AttentionStatus.TERMINATED;
    const attentionUpdated = await this.update(user, attentionFinished);

    // Consume package session if this attention is part of a package
    if (attentionUpdated.packageId) {
      try {
        await this.packageService.consumeSession(
          user || 'system',
          attentionUpdated.packageId,
          attentionUpdated.id,
          attentionUpdated.bookingId
        );
        this.logger.info('Package session consumed', {
          packageId: attentionUpdated.packageId,
          attentionId: attentionUpdated.id,
          user,
        });
      } catch (error) {
        // Log error but don't fail the checkout finish process
        this.logger.logError(
          error instanceof Error ? error : new Error(String(error)),
          undefined,
          {
            packageId: attentionUpdated.packageId,
            attentionId: attentionUpdated.id,
            operation: 'consumePackageSession',
            user,
          }
        );
      }
    }

    // Automatically charge pesquisa (survey) when attention is marked as finished
    try {
      const hasIncome = await this.hasIncomeForAttention(attentionId);
      const isSurveyAttention =
        attention.type === AttentionType.SURVEY_ONLY ||
        (attention.surveyId && attention.surveyId.trim().length > 0);

      if (!hasIncome && isSurveyAttention) {
        let totalAmount = 0;

        // Try to get price from services if available
        if (attention.servicesId && attention.servicesId.length > 0) {
          const services = await this.serviceService.getServicesById(attention.servicesId);
          for (const service of services) {
            if (service && service.serviceInfo && service.serviceInfo.price) {
              totalAmount += service.serviceInfo.price;
            }
          }
        }

        // If no service price found, try to get from serviceId
        if (totalAmount === 0 && attention.serviceId) {
          const service = await this.serviceService.getServiceById(attention.serviceId);
          if (service && service.serviceInfo && service.serviceInfo.price) {
            totalAmount = service.serviceInfo.price;
          }
        }

        // Only create income if there's a price > 0
        if (totalAmount > 0) {
          await this.incomeService.createIncome(
            user || 'system',
            attention.commerceId,
            IncomeType.UNIQUE,
            IncomeStatus.CONFIRMED,
            attention.bookingId,
            attention.id,
            attention.clientId,
            attention.packageId,
            totalAmount,
            totalAmount,
            1, // installments
            PaymentMethod.OTHER, // Default payment method for automatic charges
            0, // commission
            `Cobrança automática de pesquisa - Atenção ${attention.number}`,
            '', // fiscalNote
            '', // promotionalCode
            '', // transactionId
            '', // bankEntity
            { user: user || 'system', title: 'Pesquisa Automática' } // incomeInfo
          );
          this.logger.info('Automatic income created for survey attention', {
            attentionId,
            totalAmount,
            attentionType: attention.type,
            hasSurveyId: !!attention.surveyId,
            user,
          });
        }
      }
    } catch (error) {
      // Log error but don't fail the checkout finish process
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        attentionId,
        operation: 'createAutomaticIncome',
        user,
      });
    }

    this.logger.info('Checkout finished, attention terminated', {
      attentionId,
      commerceId: attention.commerceId,
      queueId: attention.queueId,
      duration: attentionUpdated.duration,
      hasComment: !!comment,
      hasSurveyScheduled: !!attentionUpdated.surveyPostAttentionDateScheduled,
      user,
    });

    return attentionUpdated;
  }

  public async finishCancelledAttention(user: string, attentionId: string): Promise<Attention> {
    const attention = await this.getAttentionById(attentionId);
    if (attention.status === AttentionStatus.USER_CANCELLED) {
      attention.status = AttentionStatus.TERMINATED_RESERVE_CANCELLED;
      attention.endAt = new Date();
      const queue = await this.queueService.getQueueById(attention.queueId);
      queue.currentAttentionNumber = queue.currentAttentionNumber + 1;
      const currentAttention = (
        await this.getAvailableAttentionByNumber(queue.currentAttentionNumber, queue.id)
      )[0];
      if (currentAttention) {
        queue.currentAttentionId = currentAttention.id;
      } else {
        queue.currentAttentionId = '';
      }
      await this.queueService.updateQueue(user, queue);
      return this.update(user, attention);
    }
    return attention;
  }

  featureToggleIsActive(featureToggle: FeatureToggleDetailsDto[], name: string): boolean {
    const feature = featureToggle.find(elem => elem.name === name);
    if (feature) {
      return feature.active;
    }
    return false;
  }

  public async notify(attentionId, moduleId, commerceLanguage): Promise<Attention[]> {
    const attention = await this.getAttentionById(attentionId); // La atenci?n en curso
    const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(
      attention.commerceId,
      FeatureToggleName.WHATSAPP
    );
    const toNotify = [];
    if (this.featureToggleIsActive(featureToggle, 'whatsapp-notify-now')) {
      toNotify.push(attention.number);
    }
    if (this.featureToggleIsActive(featureToggle, 'whatsapp-notify-one')) {
      toNotify.push(attention.number + 1);
    }
    if (this.featureToggleIsActive(featureToggle, 'whatsapp-notify-five')) {
      toNotify.push(attention.number + 5);
    }
    const notified = [];
    let message = '';
    let type;
    toNotify.forEach(async _count => {
      const attentionToNotify = (
        await this.getAttentionByNumber(_count, AttentionStatus.PENDING, attention.queueId)
      )[0];
      if (
        attentionToNotify !== undefined &&
        (attentionToNotify.type === AttentionType.STANDARD ||
          attentionToNotify.type === AttentionType.TELEMEDICINE)
      ) {
        const user = await this.userService.getUserById(attentionToNotify.userId);
        if (user.notificationOn) {
          const isTelemedicine = attentionToNotify.type === AttentionType.TELEMEDICINE;
          switch (_count - attention.number) {
            case 5:
              type = NotificationType.FALTANCINCO;
              message = NOTIFICATIONS.getFaltanCincoMessage(commerceLanguage, attention);
              break;
            case 1:
              type = NotificationType.FALTAUNO;
              message = NOTIFICATIONS.getFaltaUnoMessage(commerceLanguage, attention);
              break;
            case 0: {
              type = NotificationType.ESTUTURNO;
              if (isTelemedicine && attentionToNotify.telemedicineSessionId) {
                // Get telemedicine session details
                try {
                  const telemedicineSession = await this.telemedicineService.getSessionById(
                    attentionToNotify.telemedicineSessionId
                  );
                  const accessLink = `${
                    process.env.FRONTEND_URL || process.env.BACKEND_URL || 'http://localhost:5173'
                  }/publico/telemedicina/${telemedicineSession.id}`;
                  const scheduledDate = telemedicineSession.scheduledAt
                    ? new Date(telemedicineSession.scheduledAt).toLocaleString(
                        commerceLanguage === 'pt' ? 'pt-BR' : 'es-ES',
                        {
                          dateStyle: 'long',
                          timeStyle: 'short',
                        }
                      )
                    : null;
                  // Get access key for notification
                  const accessKey = await this.telemedicineService.getAccessKeyForNotification(
                    attentionToNotify.telemedicineSessionId
                  );
                  const telemedicineInfo = {
                    accessKey: accessKey || 'N/A',
                    accessLink,
                    scheduledDate,
                  };
                  message = NOTIFICATIONS.getEsTuTunoMessage(
                    commerceLanguage,
                    attention,
                    null,
                    telemedicineInfo
                  );
                } catch (error) {
                  this.logger.logError(
                    error instanceof Error ? error : new Error(String(error)),
                    undefined,
                    {
                      attentionId: attentionToNotify.id,
                      telemedicineSessionId: attentionToNotify.telemedicineSessionId,
                      operation: 'getTelemedicineSessionForNotification',
                    }
                  );
                  // Fallback to standard message if telemedicine session retrieval fails
                  const module = await this.moduleService.getModuleById(moduleId);
                  const moduleNumber = module.name;
                  message = NOTIFICATIONS.getEsTuTunoMessage(
                    commerceLanguage,
                    attention,
                    moduleNumber
                  );
                }
              } else {
                // Standard attention - use module
                const module = await this.moduleService.getModuleById(moduleId);
                const moduleNumber = module.name;
                message = NOTIFICATIONS.getEsTuTunoMessage(
                  commerceLanguage,
                  attention,
                  moduleNumber
                );
              }
              break;
            }
          }
          let servicePhoneNumber = undefined;
          const whatsappConnection = await this.commerceService.getWhatsappConnectionCommerce(
            attentionToNotify.commerceId
          );
          if (
            whatsappConnection &&
            whatsappConnection.connected === true &&
            whatsappConnection.whatsapp
          ) {
            servicePhoneNumber = whatsappConnection.whatsapp;
          }
          await this.notificationService.createWhatsappNotification(
            user.phone,
            attentionToNotify.userId,
            message,
            type,
            attention.id,
            attention.commerceId,
            attention.queueId,
            servicePhoneNumber
          );
          notified.push(attentionToNotify);
        }
      }
    });
    return notified;
  }

  public async notifyEmail(attentionId, moduleId, commerceLanguage): Promise<Attention[]> {
    const attention = await this.getAttentionById(attentionId); // La atenci?n en curso
    const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(
      attention.commerceId,
      FeatureToggleName.EMAIL
    );
    const toNotify = [];
    if (this.featureToggleIsActive(featureToggle, 'email-notify-now')) {
      toNotify.push(attention.number);
    }
    const notified = [];
    let moduleNumber = '';
    let colaboratorName = '';
    let templateType = '';
    toNotify.forEach(async _count => {
      const attentionToNotify = await this.getAttentionDetails(attentionId);
      if (attentionToNotify !== undefined && attentionToNotify.type === AttentionType.STANDARD) {
        if (attentionToNotify.user.notificationEmailOn) {
          if (attentionToNotify.user && attentionToNotify.user.email) {
            switch (_count - attention.number) {
              case 0: {
                const module = await this.moduleService.getModuleById(moduleId);
                const collaborator = await this.collaboratorService.getCollaboratorById(
                  attention.collaboratorId
                );
                moduleNumber = module.name;
                colaboratorName = collaborator.name;
                templateType = NotificationTemplate.ITSYOURTURN;
                break;
              }
            }
          }
          const template = `${templateType}-${commerceLanguage}`;
          const link = `${process.env.BACKEND_URL}/interno/fila/${attention.queueId}/atencion/${attention.id}`;
          const logo = `${process.env.BACKEND_URL}/${attentionToNotify.commerce.logo}`;
          const attentionNumber = attention.number;
          const commerce = attentionToNotify.commerce.name;
          await this.notificationService.createEmailNotification(
            attentionToNotify.user.email,
            attention.userId,
            NotificationType.TUTURNO,
            attention.id,
            attention.commerceId,
            attention.queueId,
            template,
            attentionNumber,
            commerce,
            link,
            logo,
            moduleNumber,
            colaboratorName
          );
          notified.push(attentionToNotify);
        }
      }
    });
    return notified;
  }

  public async attentionEmail(attentionId: string): Promise<Attention[]> {
    const attention = await this.getAttentionDetails(attentionId); // La atenci?n en curso
    const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(
      attention.commerceId,
      FeatureToggleName.EMAIL
    );
    const toNotify = [];
    if (this.featureToggleIsActive(featureToggle, 'email-attention')) {
      toNotify.push(attention.number);
    }
    const notified = [];
    const commerceLanguage = attention.commerce.localeInfo.language;
    toNotify.forEach(async _count => {
      if (attention !== undefined && attention.type === AttentionType.STANDARD) {
        if (attention.user.email) {
          const template = `${NotificationTemplate.YOURTURN}-${commerceLanguage}`;
          const link = `${process.env.BACKEND_URL}/interno/fila/${attention.queueId}/atencion/${attention.id}`;
          const logo = `${process.env.BACKEND_URL}/${attention.commerce.logo}`;
          const attentionNumber = attention.number;
          const commerce = attention.commerce.name;
          await this.notificationService.createAttentionEmailNotification(
            attention.user.email,
            attention.userId,
            NotificationType.TUTURNO,
            attention.id,
            attention.commerceId,
            attention.queueId,
            template,
            attentionNumber,
            commerce,
            link,
            logo
          );
          notified.push(attention);
        }
      }
    });
    return notified;
  }

  public async csatEmail(
    attention: AttentionDetailsDto,
    attentionCommerce: CommerceKeyNameDetailsDto
  ): Promise<Attention[]> {
    const featureToggle = attentionCommerce.features;
    const toNotify = [];
    if (this.featureToggleIsActive(featureToggle, 'email-csat')) {
      toNotify.push(attention.number);
    }
    const notified = [];
    const commerceLanguage = attention.commerce.localeInfo.language;
    toNotify.forEach(async _count => {
      if (
        (attention !== undefined && attention.type === AttentionType.STANDARD) ||
        attention.type === AttentionType.SURVEY_ONLY
      ) {
        if (attention.user.email) {
          const template = `${NotificationTemplate.CSAT}-${commerceLanguage}`;
          const link = `${process.env.BACKEND_URL}/interno/fila/${attention.queueId}/atencion/${attention.id}`;
          const logo = `${process.env.BACKEND_URL}/${attention.commerce.logo}`;
          const attentionNumber = attention.number;
          const commerce = attention.commerce.name;
          await this.notificationService.createAttentionEmailNotification(
            attention.user.email,
            attention.userId,
            NotificationType.TUTURNO,
            attention.id,
            attention.commerceId,
            attention.queueId,
            template,
            attentionNumber,
            commerce,
            link,
            logo
          );
          notified.push(attention);
        }
      }
    });
    return notified;
  }

  public async postAttentionEmail(
    attention: AttentionDetailsDto,
    attentionCommerce: CommerceKeyNameDetailsDto
  ): Promise<Attention[]> {
    const featureToggle = attentionCommerce.features;
    const toNotify = [];
    if (this.featureToggleIsActive(featureToggle, 'email-post-attention')) {
      toNotify.push(attention);
    }
    const notified = [];
    const commerceLanguage = attentionCommerce.localeInfo.language;
    toNotify.forEach(async attention => {
      if (attention !== undefined) {
        if (attention.user.email) {
          let documentAttachament: Attachment;
          const document = await this.documentsService.getDocument(
            `${attentionCommerce.id}.pdf`,
            'post_attention'
          );
          if (document) {
            const chunks = [];
            document.on('data', function (chunk) {
              chunks.push(chunk);
            });
            let content;
            await document.on('end', async () => {
              content = Buffer.concat(chunks);
              documentAttachament = {
                content,
                filename: `post_attention-${attentionCommerce.name}.pdf`,
                encoding: 'base64',
              };
              const from = process.env.EMAIL_SOURCE;
              const to = [attention.user.email];
              const emailData = NOTIFICATIONS.getPostAttetionCommerce(
                commerceLanguage,
                attentionCommerce
              );
              const subject = emailData.subject;
              const htmlTemplate = emailData.html;
              const attachments = [documentAttachament];
              const logo = `${process.env.BACKEND_URL}/${attentionCommerce.logo}`;
              const commerce = attentionCommerce.name;
              const html = htmlTemplate
                .replaceAll('{{logo}}', logo)
                .replaceAll('{{commerce}}', commerce);
              await this.notificationService.createAttentionRawEmailNotification(
                NotificationType.POST_ATTENTION,
                attention.id,
                attentionCommerce.id,
                from,
                to,
                subject,
                attachments,
                html
              );
              notified.push(attention);
            });
          }
        }
      }
    });
    return notified;
  }

  public async csatWhatsapp(
    attention: AttentionDetailsDto,
    attentionCommerce: CommerceKeyNameDetailsDto
  ): Promise<Attention[]> {
    const featureToggle = attentionCommerce.features;
    const toNotify = [];
    if (this.featureToggleIsActive(featureToggle, 'whatsapp-csat')) {
      toNotify.push(attention.number);
    }
    const notified = [];
    const commerceLanguage = attention.commerce.localeInfo.language;
    toNotify.forEach(async _count => {
      if (
        attention !== undefined &&
        (attention.type === AttentionType.STANDARD || attention.type === AttentionType.SURVEY_ONLY)
      ) {
        if (attention.user) {
          if (attention.user.phone) {
            const link = `${process.env.BACKEND_URL}/interno/fila/${attention.queueId}/atencion/${attention.id}`;
            const message = NOTIFICATIONS.getEncuestaMessage(commerceLanguage, attention, link);
            let servicePhoneNumber = undefined;
            const whatsappConnection = await this.commerceService.getWhatsappConnectionCommerce(
              attention.commerceId
            );
            if (
              whatsappConnection &&
              whatsappConnection.connected === true &&
              whatsappConnection.whatsapp
            ) {
              servicePhoneNumber = whatsappConnection.whatsapp;
            }
            await this.notificationService.createWhatsappNotification(
              attention.user.phone,
              attention.user.id,
              message,
              NotificationType.ENCUESTA,
              attention.id,
              attention.commerceId,
              attention.queueId,
              servicePhoneNumber
            );
            notified.push(attention);
          }
        }
      }
    });
    return notified;
  }

  public async attentionCancelWhatsapp(attentionId: string): Promise<Attention[]> {
    const attention = await this.getAttentionDetails(attentionId);
    const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(
      attention.commerceId,
      FeatureToggleName.WHATSAPP
    );
    const toNotify = [];
    if (this.featureToggleIsActive(featureToggle, 'attention-whatsapp-cancel')) {
      toNotify.push(attention.number);
    }
    const notified = [];
    const commerceLanguage = attention.commerce.localeInfo.language;
    toNotify.forEach(async _count => {
      if (
        attention !== undefined &&
        (attention.type === AttentionType.STANDARD || attention.type === AttentionType.SURVEY_ONLY)
      ) {
        if (attention.user) {
          if (attention.user.phone) {
            const link = `${process.env.BACKEND_URL}/interno/comercio/${attention.commerce.keyName}`;
            const message = NOTIFICATIONS.getAtencionCanceladaMessage(
              commerceLanguage,
              attention,
              link
            );
            let servicePhoneNumber = undefined;
            const whatsappConnection = await this.commerceService.getWhatsappConnectionCommerce(
              attention.commerceId
            );
            if (
              whatsappConnection &&
              whatsappConnection.connected === true &&
              whatsappConnection.whatsapp
            ) {
              servicePhoneNumber = whatsappConnection.whatsapp;
            }
            await this.notificationService.createWhatsappNotification(
              attention.user.phone,
              attention.user.id,
              message,
              NotificationType.ATTENTION_CANCELLED,
              attention.id,
              attention.commerceId,
              attention.queueId,
              servicePhoneNumber
            );
            notified.push(attention);
          }
        }
      }
    });
    return notified;
  }

  public async setNoDevice(
    user: string,
    id: string,
    assistingCollaboratorId: string,
    name?: string,
    commerceId?: string,
    queueId?: string
  ): Promise<Attention> {
    const attention = await this.getAttentionById(id);
    attention.type = AttentionType.NODEVICE;
    attention.assistingCollaboratorId = assistingCollaboratorId;
    const userCreated = await this.userService.createUser(
      name,
      undefined,
      undefined,
      commerceId,
      queueId
    );
    attention.userId = userCreated.id;
    return await this.update(user, attention);
  }

  public async cancelAttention(user: string, attentionId: string): Promise<Attention> {
    let attention = await this.getAttentionById(attentionId);
    if (attention && attention.id) {
      // Allow cancellation for PENDING, PROCESSING, and REACTIVATED statuses
      if (
        attention.status === AttentionStatus.PENDING ||
        attention.status === AttentionStatus.PROCESSING ||
        attention.status === AttentionStatus.REACTIVATED
      ) {
        attention.status = AttentionStatus.USER_CANCELLED;
        attention.cancelled = true;
        attention.cancelledAt = new Date();
        const attentionCancelled = await this.update(user, attention);

        // Cancel telemedicine session if exists
        if (attentionCancelled.telemedicineSessionId) {
          try {
            await this.telemedicineService.cancelSession(
              attentionCancelled.telemedicineSessionId,
              user
            );
            this.logger.log(
              `[AttentionService] Cancelled telemedicine session ${attentionCancelled.telemedicineSessionId} for cancelled attention ${attentionCancelled.id}`
            );
          } catch (error) {
            this.logger.error(
              `[AttentionService] Failed to cancel telemedicine session ${attentionCancelled.telemedicineSessionId}: ${error.message}`
            );
            // Don't throw, continue with attention cancellation
          }
        }

        await this.attentionCancelWhatsapp(attentionCancelled.id);
        const packs = await this.packageService.getPackageByCommerceIdAndClientId(
          attentionCancelled.commerceId,
          attentionCancelled.clientId
        );
        if (packs && packs.length > 0) {
          for (let i = 0; i < packs.length; i++) {
            const pack = packs[i];
            await this.packageService.removeProcedureToPackage(
              user,
              pack.id,
              attentionCancelled.bookingId,
              attentionCancelled.id
            );
          }
        }
        attention = attentionCancelled;
      }
    } else {
      throw new HttpException(`Attention no existe`, HttpStatus.NOT_FOUND);
    }
    return attention;
  }

  public async cancellAtentions(): Promise<string> {
    try {
      const attentions = await this.attentionRepository
        .whereIn('status', [AttentionStatus.PENDING, AttentionStatus.PROCESSING])
        .find();

      // Cancel telemedicine sessions for all cancelled attentions
      for (const attention of attentions) {
        attention.status = AttentionStatus.CANCELLED;
        const attentionCancelled = await this.update('ett', attention);

        // Cancel telemedicine session if exists
        if (attentionCancelled.telemedicineSessionId) {
          try {
            await this.telemedicineService.cancelSession(
              attentionCancelled.telemedicineSessionId,
              'ett'
            );
            this.logger.log(
              `[AttentionService] Cancelled telemedicine session ${attentionCancelled.telemedicineSessionId} for cancelled attention ${attentionCancelled.id}`
            );
          } catch (error) {
            this.logger.error(
              `[AttentionService] Failed to cancel telemedicine session ${attentionCancelled.telemedicineSessionId}: ${error.message}`
            );
            // Don't throw, continue with attention cancellation
          }
        }
      }

      return 'Las atenciones pendientes fueron canceladas exitosamente';
    } catch (error) {
      throw new HttpException(
        `Hubo un poblema al cancelar las atenciones: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async attentionPaymentConfirm(
    user: string,
    id: string,
    confirmationData: PaymentConfirmation
  ): Promise<Attention> {
    try {
      let attention = await this.getAttentionById(id);
      if (attention && attention.id) {
        const attentionCommerce = await this.commerceService.getCommerceById(attention.commerceId);
        const featureToggle = attentionCommerce.features;
        // GESTION DE PAQUETE
        let pack;
        if (confirmationData !== undefined) {
          if (confirmationData.packageId) {
            pack = await this.packageService.addProcedureToPackage(
              user,
              confirmationData.packageId,
              [],
              [id]
            );
          } else if (
            confirmationData.procedureNumber === 1 &&
            confirmationData.proceduresTotalNumber > 1
          ) {
            let packageName;
            if (attention.servicesDetails && attention.servicesDetails.length > 0) {
              const names = attention.servicesDetails.map(service => service['tag']);
              if (names && names.length > 0) {
                packageName = names.join('/').toLocaleUpperCase();
              }
            }
            pack = await this.packageService.createPackage(
              user,
              attention.commerceId,
              attention.clientId,
              undefined,
              id,
              confirmationData.proceduresTotalNumber,
              packageName,
              attention.servicesId,
              [],
              [id],
              PackageType.STANDARD,
              PackageStatus.CONFIRMED
            );
          }
        }
        if (pack && pack.id) {
          attention.packageId = pack.id;
        }
        if (this.featureToggleIsActive(featureToggle, 'attention-confirm-payment')) {
          const packageId = pack && pack.id ? pack.id : undefined;
          attention.paidAt = new Date();
          attention.paid = true;
          if (
            confirmationData === undefined ||
            confirmationData.paid === false ||
            !confirmationData.paymentDate ||
            confirmationData.paymentAmount === undefined ||
            confirmationData.paymentAmount < 0
          ) {
            throw new HttpException(
              `Datos insuficientes para confirmar el pago de la atenci?n`,
              HttpStatus.INTERNAL_SERVER_ERROR
            );
          }
          confirmationData.user = user ? user : 'ett';
          attention.paymentConfirmationData = confirmationData;
          attention.confirmed = true;
          attention.confirmedAt = new Date();
          attention.confirmedBy = user;
          // GESTION DE ENTRADA EN CAJA
          if (confirmationData !== undefined) {
            let income;
            if (confirmationData.pendingPaymentId) {
              income = await this.incomeService.payPendingIncome(
                user,
                confirmationData.pendingPaymentId,
                confirmationData.paymentAmount,
                confirmationData.paymentMethod,
                confirmationData.paymentCommission,
                confirmationData.paymentComment,
                confirmationData.paymentFiscalNote,
                confirmationData.promotionalCode,
                confirmationData.transactionId,
                confirmationData.bankEntity
              );
            } else {
              if (confirmationData.installments && confirmationData.installments > 1) {
                income = await this.incomeService.createIncomes(
                  user,
                  attention.commerceId,
                  IncomeStatus.CONFIRMED,
                  attention.bookingId,
                  attention.id,
                  attention.clientId,
                  packageId,
                  confirmationData.paymentAmount,
                  confirmationData.totalAmount,
                  confirmationData.installments,
                  confirmationData.paymentMethod,
                  confirmationData.paymentCommission,
                  confirmationData.paymentComment,
                  confirmationData.paymentFiscalNote,
                  confirmationData.promotionalCode,
                  confirmationData.transactionId,
                  confirmationData.bankEntity,
                  confirmationData.confirmInstallments,
                  { user }
                );
              } else {
                if (!packageId || !pack.paid || pack.paid === false) {
                  income = await this.incomeService.createIncome(
                    user,
                    attention.commerceId,
                    IncomeType.UNIQUE,
                    IncomeStatus.CONFIRMED,
                    attention.bookingId,
                    attention.id,
                    attention.clientId,
                    packageId,
                    confirmationData.paymentAmount,
                    confirmationData.totalAmount,
                    confirmationData.installments,
                    confirmationData.paymentMethod,
                    confirmationData.paymentCommission,
                    confirmationData.paymentComment,
                    confirmationData.paymentFiscalNote,
                    confirmationData.promotionalCode,
                    confirmationData.transactionId,
                    confirmationData.bankEntity,
                    { user }
                  );
                }
              }
            }
            if (income && income.id) {
              if (packageId) {
                await this.packageService.payPackage(user, packageId, [income.id]);
              }
            }
          }
        }
        attention = await this.update(user, attention);
        return attention;
      }
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al pagar la atenci?n: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async transferAttentionToQueue(
    user: string,
    id: string,
    queueId: string
  ): Promise<Attention> {
    let attention = undefined;
    try {
      attention = await this.getAttentionById(id);
      const queueToTransfer = await this.queueService.getQueueById(queueId);
      if (attention && attention.id) {
        if (queueToTransfer && queueToTransfer.id) {
          if (queueToTransfer.type === QueueType.COLLABORATOR) {
            attention.transfered = true;
            attention.transferedAt = new Date();
            attention.transferedOrigin = attention.queueId;
            attention.queueId = queueId;
            attention.transferedBy = user;
            attention = await this.update(user, attention);
          } else {
            throw new HttpException(
              `Atenci?n ${id} no puede ser transferida pues la cola de destino no es de tipo Colaborador: ${queueId}, ${queueToTransfer.type}`,
              HttpStatus.NOT_FOUND
            );
          }
        } else {
          throw new HttpException(`Cola no existe: ${queueId}`, HttpStatus.NOT_FOUND);
        }
      } else {
        throw new HttpException(`Atenci?n no existe: ${id}`, HttpStatus.NOT_FOUND);
      }
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al cancelar la atenci?n: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return attention;
  }

  public async surveyPostAttention(date: string): Promise<any> {
    const limiter = new Bottleneck({
      minTime: 1000,
      maxConcurrent: 10,
    });
    const responses = [];
    const errors = [];
    let toProcess = 0;
    try {
      const today = date || new DateModel().toString();
      const attentions = await this.getPostAttentionScheduledSurveys(today, 25);
      toProcess = attentions?.length || 0;
      if (attentions && attentions.length > 0) {
        const promises = [];
        for (let i = 0; i < attentions.length; i++) {
          let attention = attentions[i];
          if (!attention || !attention.id) {
            this.logger.warn('Invalid attention found in scheduled surveys', {
              date: today,
              attentionIndex: i,
            });
            continue;
          }
          const promise = limiter.schedule(async () => {
            try {
              const attentionDetails = await this.getAttentionDetails(attention.id);
              if (!attentionDetails) {
                this.logger.warn('Attention details not found', { attentionId: attention.id });
                errors.push(new Error(`Attention details not found for ${attention.id}`));
                return;
              }
              const commerce = attentionDetails.commerce;
              if (!commerce) {
                this.logger.warn('Commerce not found in attention details', {
                  attentionId: attention.id,
                });
                errors.push(new Error(`Commerce not found for attention ${attention.id}`));
                return;
              }
              this.csatEmail(attentionDetails, commerce);
              this.csatWhatsapp(attentionDetails, commerce);
              attention.notificationSurveySent = true;
              attention = await this.update('ett', attention);
            } catch (error) {
              this.logger.warn('Error processing scheduled survey', {
                attentionId: attention?.id,
                error: error instanceof Error ? error.message : String(error),
              });
              errors.push(error);
            }
            responses.push(attention);
          });
          promises.push(promise);
        }
        // Wait for all scheduled jobs to complete
        if (promises.length > 0) {
          await Promise.all(promises);
        }
      }
      const response = { toProcess, processed: responses.length, errors: errors.length };
      this.logger.info('Post-attention surveys processed', {
        date,
        toProcess,
        processed: responses.length,
        errors: errors.length,
        errorDetails: errors.length > 0 ? errors.map(e => e.message || String(e)) : undefined,
      });
      return response;
    } catch (error) {
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        date,
        operation: 'surveyPostAttention',
      });
      throw new HttpException(
        `Hubo un problema al enviar las encuestas: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    } finally {
      // Ensure limiter is always stopped, even if there's an error
      try {
        await limiter.stop({ dropWaitingJobs: false });
      } catch (stopError) {
        this.logger.warn('Error stopping limiter', {
          error: stopError instanceof Error ? stopError.message : String(stopError),
        });
      }
    }
  }
}
