import { Attention, Block } from './model/attention.entity';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { QueueService } from '../queue/queue.service';
import { CollaboratorService } from '../collaborator/collaborator.service';
import { AttentionStatus } from './model/attention-status.enum';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';
import { ModuleService } from '../module/module.service';
import { NotificationType } from '../notification/model/notification-type.enum';
import { publish } from 'ett-events-lib';
import { FeatureToggleService } from '../feature-toggle/feature-toggle.service';
import { FeatureToggleName } from '../feature-toggle/model/feature-toggle.enum';
import { FeatureToggle } from '../feature-toggle/model/feature-toggle.entity';
import AttentionUpdated from './events/AttentionUpdated';
import { AttentionType } from './model/attention-type.enum';
import { AttentionDefaultBuilder } from './builders/attention-default';
import { AttentionSurveyBuilder } from './builders/attention-survey';
import { AttentionNoDeviceBuilder } from './builders/attention-no-device';
import { AttentionChannel } from './model/attention-channel.enum';
import { AttentionDetailsDto } from './dto/attention-details.dto';
import { CommerceService } from '../commerce/commerce.service';
import { PersonalInfo, User } from '../user/model/user.entity';
import { NotificationTemplate } from 'src/notification/model/notification-template.enum';
import { AttentionReserveBuilder } from './builders/attention-reserve';
import { PaymentConfirmation } from 'src/payment/model/payment-confirmation';

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
    private commerceService: CommerceService
  ) { }

  public async getAttentionById(id: string): Promise<Attention> {
    return await this.attentionRepository.findById(id);
  }

  public async getAttentionDetails(id: string): Promise<AttentionDetailsDto> {
    try {
      const attention = await this.getAttentionById(id);
      let attentionDetailsDto: AttentionDetailsDto = new AttentionDetailsDto();

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
      if (attention.queueId) {
          attentionDetailsDto.queue = await this.queueService.getQueueById(attention.queueId);
          attentionDetailsDto.commerce = await this.commerceService.getCommerceById(attentionDetailsDto.queue.commerceId);
          delete attentionDetailsDto.commerce.queues;
      }
      if (attention.userId !== undefined) {
          attentionDetailsDto.user = await this.userService.getUserById(attention.userId);
      }
      if (attention.collaboratorId !== undefined) {
          attentionDetailsDto.collaborator = await this.collaboratorService.getCollaboratorById(attention.collaboratorId);
      }
      if (attention.moduleId !== undefined) {
          attentionDetailsDto.module = await this.moduleService.getModuleById(attention.moduleId);
      }
      return attentionDetailsDto;
    } catch(error) {
      throw new HttpException(`Hubo un problema al obtener detalles de la atención`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async getAttentionUserDetails(id: string): Promise<AttentionDetailsDto> {
    try {
      const attention = await this.getAttentionById(id);
      let attentionDetailsDto: AttentionDetailsDto = new AttentionDetailsDto();
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
      if (attention.userId !== undefined) {
          attentionDetailsDto.user = await this.userService.getUserById(attention.userId);
      }
      return attentionDetailsDto;
    } catch(error) {
      throw new HttpException(`Hubo un problema al obtener detalles de la atención`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async getAttentionDetailsByNumber(number: number, status: AttentionStatus, queueId: string): Promise<AttentionDetailsDto> {
    const attention = await this.getAttentionByNumber(+number, status, queueId);
    if (attention.length > 0) {
      return await this.getAttentionDetails(attention[0].id);
    }
  }

  public async getAvailableAttentionDetailsByNumber(number: number, queueId: string): Promise<AttentionDetailsDto> {
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

  public async getAttentionDetailsByQueueAndStatuses(status: AttentionStatus, queueId: string): Promise<AttentionDetailsDto[]> {
    const result = [];
    const attentions = await this.getAttentionByQueueAndStatus(status, queueId);
    if (attentions.length > 0) {
      for(let i = 0; i < attentions.length; i++) {
        const attention = await this.getAttentionUserDetails(attentions[i].id);
        result.push(attention);
      }
    }
    return result;
  }

  public async getAvailableAttentionDetailsByQueues(queueId: string): Promise<AttentionDetailsDto[]> {
    const result = [];
    const attentions = await this.getAvailableAttentiosnByQueue(queueId);
    if (attentions.length > 0) {
      for(let i = 0; i < attentions.length; i++) {
        const attention = await this.getAttentionUserDetails(attentions[i].id);
        result.push(attention);
      }
    }
    return result;
  }

  public async getAttentionByNumber(number: number, status: AttentionStatus, queueId: string): Promise<Attention[]> {
    return await this.attentionRepository.whereEqualTo('queueId', queueId)
    .whereEqualTo('number', number)
    .whereEqualTo('status', status)
    .orderByDescending('createdAt')
    .find();
  }

  public async getAvailableAttentionByNumber(number: number, queueId: string): Promise<Attention[]> {
    return await this.attentionRepository.whereEqualTo('queueId', queueId)
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

  public async getProcessingAttentionDetailsByQueue(queueId: string): Promise<AttentionDetailsDto[]> {
    const result = [];
    const attentions = await this.getProcessingAttentionsByQueue(queueId);
    if (attentions.length > 0) {
      for(let i = 0; i < attentions.length; i++) {
        const attention = await this.getAttentionUserDetails(attentions[i].id);
        result.push(attention);
      }
    }
    return result;
  }

  public async getAttentionByNumberAndDate(number: number, status: AttentionStatus, queueId: string, date: Date): Promise<Attention[]> {
    const startDate = date.toISOString().slice(0,10);
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
    const startDate = new Date(date).toISOString().slice(0,10);
    const dateValue = new Date(startDate);
    return await this.attentionRepository
      .whereEqualTo('queueId', queueId)
      .whereGreaterOrEqualThan('createdAt', dateValue)
      .orderByDescending('createdAt')
      .find();
  }

  public async getAttentionByQueue(status: AttentionStatus, queueId: string): Promise<Attention[]> {
    return await this.attentionRepository.whereEqualTo('queueId', queueId)
    .whereEqualTo('status', status)
    .orderByAscending('createdAt')
    .find();
  }

  public async getAttentionByQueueAndStatus(status: AttentionStatus, queueId: string): Promise<Attention[]> {
    return await this.attentionRepository.whereEqualTo('queueId', queueId)
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

  public async createAttention(
      queueId: string,
      collaboratorId?: string,
      channel: string = AttentionChannel.QR,
      userIn?: User,
      type?: AttentionType,
      block?: Block,
      date?: Date,
      paymentConfirmationData?: PaymentConfirmation,
      bookingId?: string
    ): Promise<Attention> {

      try {
        let attentionCreated;
        let queue = await this.queueService.getQueueById(queueId);
        const newUser = userIn ? userIn : new User();
        const user = await this.userService.createUser(newUser.name, newUser.phone, newUser.email, queue.commerceId, queue.id, newUser.lastName, newUser.idNumber, newUser.notificationOn, newUser.notificationEmailOn, newUser.personalInfo);
        const userId = user.id;
        const onlySurvey = await this.featureToggleService.getFeatureToggleByNameAndCommerceId(queue.commerceId, 'only-survey');
        if (type && type === AttentionType.NODEVICE) {
          if (block && block.number) {
            attentionCreated = await this.attentionReserveBuilder.create(queue, collaboratorId, type, channel, userId, block, date, paymentConfirmationData, bookingId);
          } else {
            attentionCreated = await this.attentionNoDeviceBuilder.create(queue, collaboratorId, channel, userId, date);
          }
        } else if (onlySurvey) {
          if (onlySurvey.active) {
            const collaboratorBot = await this.collaboratorService.getCollaboratorBot(queue.commerceId);
            if (!collaboratorBot || collaboratorBot === undefined) {
              throw new HttpException(`Colaborador Bot no existe, debe crearse`, HttpStatus.INTERNAL_SERVER_ERROR);
            }
            const attentionBuild = await this.attentionSurveyBuilder.create(queue, collaboratorBot.id, channel, userId, date);
            attentionCreated = await this.finishAttention(attentionBuild.userId, attentionBuild.id, '');
          } else {
            attentionCreated = await this.attentionDefaultBuilder.create(queue, collaboratorId, channel, userId, date);
          }
        } else if (block && block.number) {
          attentionCreated = await this.attentionReserveBuilder.create(queue, collaboratorId, AttentionType.STANDARD, channel, userId, block, date, paymentConfirmationData, bookingId);
        } else {
          attentionCreated = await this.attentionDefaultBuilder.create(queue, collaboratorId, channel, userId);
        }
        if (user.email !== undefined) {
          await this.attentionEmail(attentionCreated.id);
        }
        return attentionCreated;
      } catch (error) {
        throw new HttpException(`Hubo un problema al crear la atención: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
      }
  }

  public async saveDataNotification(user: string, attentionId: string, name?: string, phone?: string, email?: string, commerceId?: string, queueId?: string, lastName?: string, idNumber?: string, notificationOn?: boolean, notificationEmailOn?: boolean, personalInfo?: PersonalInfo): Promise<Attention> {
    const attention = await this.getAttentionById(attentionId);
    let userToNotify = undefined;
    if (attention.userId !== undefined) {
      userToNotify = await this.userService.updateUser(name, attention.userId, name, phone, email, commerceId, queueId, lastName, idNumber, notificationOn, notificationEmailOn, personalInfo);
    } else {
      userToNotify = await this.userService.createUser(name, phone, email, commerceId, queueId, lastName, idNumber, notificationOn, notificationEmailOn, personalInfo);
      attention.userId = userToNotify.id;
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
    publish(attentionUpdatedEvent);
    return attentionUpdated;
  }

  public async attend(user: string, number: number, queueId: string, collaboratorId: string, commerceLanguage: string, notify?: boolean) {
    let attention = (await this.getAvailableAttentionByNumber(number, queueId))[0];
    if (attention) {
      let queue = await this.queueService.getQueueById(attention.queueId);
      try {
        if (attention.status === AttentionStatus.PENDING) {
          const collaborator = await this.collaboratorService.getCollaboratorById(collaboratorId);
          attention.collaboratorId = collaborator.id;
          attention.moduleId = collaborator.moduleId;
          attention.status = AttentionStatus.PROCESSING;

          queue.currentAttentionNumber = queue.currentAttentionNumber + 1;
          const currentAttention = (await this.getAvailableAttentionByNumber(queue.currentAttentionNumber, queue.id))[0];
          if(currentAttention) {
            queue.currentAttentionId = currentAttention.id;
          } else{
            queue.currentAttentionId = '';
          }
          await this.queueService.updateQueue(user, queue);

          await this.notify(attention.id, collaborator.moduleId, commerceLanguage);
          attention = await this.update(user, attention);
          await this.notifyEmail(attention.id, collaborator.moduleId, commerceLanguage);
        } else if (attention.status === AttentionStatus.USER_CANCELLED){
          attention = await this.finishCancelledAttention(user, attention.id);
        }
        return attention;
      } catch (error) {
        throw new HttpException(`Hubo un problema al procesar la atención: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }

  public async skip(user: string, number: number, queueId: string, collaboratorId: string) {
    const attention = (await this.getAttentionByNumber(number, AttentionStatus.PROCESSING, queueId))[0];
    if (!attention) {
      throw new HttpException(`Atencion que se quiere saltar no existe o ya fue saltada antes: ${attention.id}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    const collaborator = await this.collaboratorService.getCollaboratorById(collaboratorId);
    let queue = await this.queueService.getQueueById(attention.queueId);
    if (attention.status === AttentionStatus.PROCESSING || attention.status === AttentionStatus.REACTIVATED) {
      attention.status = AttentionStatus.SKIPED;
      attention.collaboratorId = collaborator.id;
      let currentAttention = (await this.getAttentionByNumber(queue.currentAttentionNumber, AttentionStatus.PENDING, queue.id))[0];
      if (currentAttention && currentAttention.id !== undefined) {
        queue.currentAttentionId = currentAttention.id;
      } else {
        queue.currentAttentionId = '';
      }
      await this.queueService.updateQueue(user, queue);
      await this.update(user, attention);
    } else {
      throw new HttpException(`Hubo un problema, esta atención no puede ser saltada: ${attention.id}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return attention;
  }

  public async reactivate(user: string, number: number, queueId: string, collaboratorId: string) {
    try {
      const attention = (await this.getAttentionByNumberAndDate(number, AttentionStatus.SKIPED, queueId, new Date()))[0];
      const collaborator = await this.collaboratorService.getCollaboratorById(collaboratorId);
      attention.status = AttentionStatus.REACTIVATED;
      attention.collaboratorId = collaborator.id;
      attention.reactivated = true;
      attention.reactivatedAt = new Date();
      const result = await this.update(user, attention);
      return result;
    } catch (error) {
      throw new HttpException(`Hubo un problema esta atención no está saltada: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async finishAttention(user: string, attentionId: string, comment: string, date?: Date): Promise<Attention> {
    let attention = await this.getAttentionById(attentionId);
    if (attention.status === AttentionStatus.PROCESSING || attention.status === AttentionStatus.REACTIVATED) {
      attention.status = AttentionStatus.TERMINATED;
      if (comment) {
        attention.comment = comment;
      }
      attention.endAt = date || new Date();
      if(!attention.reactivated) {
        const diff = attention.endAt.getTime() - attention.createdAt.getTime();
        attention.duration = diff/(1000*60);
      }
      await this.csatEmail(attention.id);
      await this.csatWhatsapp(attention.id);
      return this.update(user, attention);
    }
    return attention;
  }

  public async finishCancelledAttention(user: string, attentionId: string): Promise<Attention> {
    let attention = await this.getAttentionById(attentionId);
    if (attention.status === AttentionStatus.USER_CANCELLED) {
      attention.status = AttentionStatus.TERMINATED_RESERVE_CANCELLED;
      attention.endAt = new Date();
      let queue = await this.queueService.getQueueById(attention.queueId);
      queue.currentAttentionNumber = queue.currentAttentionNumber + 1;
      const currentAttention = (await this.getAvailableAttentionByNumber(queue.currentAttentionNumber, queue.id))[0];
      if(currentAttention) {
        queue.currentAttentionId = currentAttention.id;
      }else{
        queue.currentAttentionId = '';
      }
      await this.queueService.updateQueue(user, queue);
      return this.update(user, attention);
    }
    return attention;
  }

  featureToggleIsActive(featureToggle: FeatureToggle[], name: string): boolean {
    const feature = featureToggle.find(elem => elem.name === name);
    if (feature) {
      return feature.active;
    }
    return false;
  }

  public async notify(attentionId, moduleId, commerceLanguage): Promise<Attention[]> {
    const attention = await this.getAttentionById(attentionId); // La atención en curso
    const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(attention.commerceId, FeatureToggleName.WHATSAPP);
    let toNotify = [];
    if(this.featureToggleIsActive(featureToggle, 'whatsapp-notify-now')){
      toNotify.push(attention.number);
    }
    if(this.featureToggleIsActive(featureToggle, 'whatsapp-notify-one')){
      toNotify.push(attention.number + 1);
    }
    if(this.featureToggleIsActive(featureToggle, 'whatsapp-notify-five')){
      toNotify.push(attention.number + 5);
    }
    const notified = [];
    let message = '';
    let type;
    toNotify.forEach(async count => {
      let attentionToNotify = (await this.getAttentionByNumber(count, AttentionStatus.PENDING, attention.queueId))[0];
      if (attentionToNotify !== undefined && attentionToNotify.type === AttentionType.STANDARD) {
        const user = await this.userService.getUserById(attentionToNotify.userId);
        if(user.notificationOn) {
          switch(count - attention.number) {
            case 5:
              message = commerceLanguage === 'pt'
              ? `😃 Olá, quase É a sua vez! Restam *${5}* pessoas para serem atendidas.

Lémbre-se, seu número de atendimento é: *${attention.number}*.`
              : `😃 Hola, ya casi Es tu Turno! Faltan *${5}* personas para que seas atendido.

Recuerda, tu número de atención es: *${attention.number}*.`
              type = NotificationType.FALTANCINCO
              break;
            case 1:
              message = commerceLanguage === 'pt'
              ? `😃 Olá, quase É a sua vez! Restam *${1}* pessoa para você ser tratado.

Lémbre-se, seu número de atendimento é: *${attention.number}*`
              : `😃 Hola, ¡ya casi Es tu Turno!. Falta *${1}* persona para que seas atendido.

Recuerda, tu número de atención es: *${attention.number}*`;
              type = NotificationType.FALTAUNO;
              break;
            case 0: {
              const module = await this.moduleService.getModuleById(moduleId);
              const moduleNumber = module.name;
              type = NotificationType.ESTUTURNO;
              message = commerceLanguage === 'pt'
              ? `🚨 Olá, agora É a sua Vez! Aproxime-se do módulo *${moduleNumber}*.

Lémbre-se, seu número de atendimento é: *${attention.number}*.`
              : `🚨 Hola, ahora ¡Es tu Turno! Acércate al módulo *${moduleNumber}*.

Recuerda, tu número de atención es: *${attention.number}*.`;
              break;
              }
          }
          await this.notificationService.createWhatsappNotification(user.phone, attentionToNotify.userId, message, type, attention.id, attention.commerceId, attention.queueId);
          notified.push(attentionToNotify);
        }
      }
    });
    return notified;
  }

  public async notifyEmail(attentionId, moduleId, commerceLanguage): Promise<Attention[]> {
    const attention = await this.getAttentionById(attentionId); // La atención en curso
    const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(attention.commerceId, FeatureToggleName.EMAIL);
    let toNotify = [];
    if(this.featureToggleIsActive(featureToggle, 'email-notify-now')){
      toNotify.push(attention.number);
    }
    const notified = [];
    let type;
    let moduleNumber = '';
    let colaboratorName = '';
    let templateType = '';
    toNotify.forEach(async count => {
      let attentionToNotify = await this.getAttentionDetails(attentionId);
      if (attentionToNotify !== undefined && attentionToNotify.type === AttentionType.STANDARD) {
        if(attentionToNotify.user.notificationEmailOn){
          if (attentionToNotify.user && attentionToNotify.user.email) {
            switch(count - attention.number) {
              case 0: {
                const module = await this.moduleService.getModuleById(moduleId);
                const collaborator = await this.collaboratorService.getCollaboratorById(attention.collaboratorId);
                moduleNumber = module.name;
                colaboratorName = collaborator.name;
                type = NotificationType.ESTUTURNO;
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
          await this.notificationService.createEmailNotification(attentionToNotify.user.email, attention.userId, NotificationType.TUTURNO, attention.id, attention.commerceId, attention.queueId, template, attentionNumber, commerce, link, logo, moduleNumber, colaboratorName);
          notified.push(attentionToNotify);
        }
      }
    });
    return notified;
  }

  public async attentionEmail(attentionId: string): Promise<Attention[]> {
    const attention = await this.getAttentionDetails(attentionId); // La atención en curso
    const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(attention.commerceId, FeatureToggleName.EMAIL);
    let toNotify = [];
    if(this.featureToggleIsActive(featureToggle, 'email-attention')){
      toNotify.push(attention.number);
    }
    const notified = [];
    const commerceLanguage = attention.commerce.localeInfo.language;
    toNotify.forEach(async count => {
      if (attention !== undefined && attention.type === AttentionType.STANDARD) {
        if (attention.user.email) {
          const template = `${NotificationTemplate.YOURTURN}-${commerceLanguage}`;
          const link = `${process.env.BACKEND_URL}/interno/fila/${attention.queueId}/atencion/${attention.id}`;
          const logo = `${process.env.BACKEND_URL}/${attention.commerce.logo}`;
          const attentionNumber = attention.number;
          const commerce = attention.commerce.name;
          await this.notificationService.createAttentionEmailNotification(attention.user.email, attention.userId, NotificationType.TUTURNO, attention.id, attention.commerceId, attention.queueId, template, attentionNumber, commerce, link, logo);
          notified.push(attention);
        }
      }
    });
    return notified;
  }

  public async csatEmail(attentionId: string): Promise<Attention[]> {
    const attention = await this.getAttentionDetails(attentionId);
    const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(attention.commerceId, FeatureToggleName.EMAIL);
    let toNotify = [];
    if(this.featureToggleIsActive(featureToggle, 'email-csat')){
      toNotify.push(attention.number);
    }
    const notified = [];
    const commerceLanguage = attention.commerce.localeInfo.language;
    toNotify.forEach(async count => {
      if (attention !== undefined && attention.type === AttentionType.STANDARD || attention.type === AttentionType.SURVEY_ONLY) {
        if (attention.user.email) {
          const template = `${NotificationTemplate.CSAT}-${commerceLanguage}`;
          const link = `${process.env.BACKEND_URL}/interno/fila/${attention.queueId}/atencion/${attention.id}`;
          const logo = `${process.env.BACKEND_URL}/${attention.commerce.logo}`;
          const attentionNumber = attention.number;
          const commerce = attention.commerce.name;
          await this.notificationService.createAttentionEmailNotification(attention.user.email, attention.userId, NotificationType.TUTURNO, attention.id, attention.commerceId, attention.queueId, template, attentionNumber, commerce, link, logo);
          notified.push(attention);
        }
      }
    });
    return notified;
  }

  public async csatWhatsapp(attentionId: string): Promise<Attention[]> {
    const attention = await this.getAttentionDetails(attentionId);
    const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(attention.commerceId, FeatureToggleName.WHATSAPP);
    let toNotify = [];
    if(this.featureToggleIsActive(featureToggle, 'whatsapp-csat')){
      toNotify.push(attention.number);
    }
    const notified = [];
    const commerceLanguage = attention.commerce.localeInfo.language;
    toNotify.forEach(async count => {
      if (attention !== undefined && (attention.type === AttentionType.STANDARD || attention.type === AttentionType.SURVEY_ONLY)) {
        if (attention.user) {
          if (attention.user.phone) {
            const link = `${process.env.BACKEND_URL}/interno/fila/${attention.queueId}/atencion/${attention.id}`;
            const message = commerceLanguage === 'pt'
            ?
            `😃 Obrigado por se atender em *${attention.commerce.name}*!

Como foi o atendimento? Sua opinião e muito importante pra nós. ⭐️ Ingresse aqui e avalie-nos, é menos de um minuto:

${link}

Se você não conseguir acessar o link diretamente, responda a esta mensagem ou adicione-nos aos seus contatos. Volte sempre!`
            :
            `😃 ¡Gracias por atenderte en *${attention.commerce.name}*!

¿Cómo estuvo la atención? Tu opinión es muy importante para nosotros. ⭐️ Entra aquí y califícanos, te tomará sólo 15 segundos:

${link}

Si no puedes acceder al link directamente, contesta este mensaje o agreganos a tus contactos. Vuelve pronto!`
            await this.notificationService.createWhatsappNotification(attention.user.phone, attention.user.id, message, NotificationType.ENCUESTA, attention.id, attention.commerceId, attention.queueId);
            notified.push(attention);
          }
        }
      }
    });
    return notified;
  }

  public async setNoDevice(user: string, id: string, assistingCollaboratorId: string, name?: string, commerceId?: string, queueId?: string): Promise<Attention> {
    const attention = await this.getAttentionById(id);
    attention.type = AttentionType.NODEVICE;
    attention.assistingCollaboratorId = assistingCollaboratorId;
    const userCreated = await this.userService.createUser(name, undefined, undefined, commerceId, queueId);
    attention.userId = userCreated.id;
    return await this.update(user, attention);
  }

  public async cancelAttention(user: string, attentionId: string): Promise<Attention> {
    let attention = await this.getAttentionById(attentionId);
    if (attention.status === AttentionStatus.PENDING) {
      attention.status = AttentionStatus.USER_CANCELLED;
      attention.cancelled = true;
      attention.cancelledAt = new Date();
      attention = await this.update(user, attention);
    }
    return attention;
  }

  public async cancellAtentions(): Promise<string> {
    try {
      const attentions = await this.attentionRepository.whereIn('status', [AttentionStatus.PENDING, AttentionStatus.PROCESSING]).find();
      attentions.forEach(async attention => {
        attention.status = AttentionStatus.CANCELLED;
        await this.update('ett', attention);
      });
      return 'Las atenciones pendientes fueron canceladas exitosamente';
    } catch (error) {
      throw new HttpException(`Hubo un poblema al cancelar las atenciones: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async attentionPaymentConfirm(user: string, id: string, paymentConfirmationData: PaymentConfirmation): Promise<Attention> {
    try {
      let attention = await this.getAttentionById(id);
      if (attention && attention.id) {
        const attentionCommerce = await this.commerceService.getCommerceById(attention.commerceId);
        const featureToggle = attentionCommerce.features;
        if (this.featureToggleIsActive(featureToggle, 'attention-confirm-payment')){
          attention.paidAt = new Date();
          attention.paid = true;
          if (paymentConfirmationData === undefined || paymentConfirmationData.paid === false || !paymentConfirmationData.paymentDate || !paymentConfirmationData.paymentAmount) {
            throw new HttpException(`Datos insuficientes para confirmar el pago de la atención`, HttpStatus.INTERNAL_SERVER_ERROR);
          }
          paymentConfirmationData.user = user ? user : 'ett';
          attention.paymentConfirmationData = paymentConfirmationData;
        }
        attention = await this.update(user, attention);
        return attention;
      }
    } catch (error) {
      throw new HttpException(`Hubo un problema al pagar la atención: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

}