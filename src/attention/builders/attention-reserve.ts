import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { BuilderInterface } from '../../shared/interfaces/builder';
import { AttentionStatus } from '../model/attention-status.enum';
import { AttentionType } from '../model/attention-type.enum';
import { Attention, Block } from '../model/attention.entity';
import { QueueService } from '../../queue/queue.service';
import { Queue } from '../../queue/model/queue.entity';
import AttentionCreated from '../events/AttentionCreated';
import { publish } from 'ett-events-lib';
import { PaymentConfirmation } from 'src/payment/model/payment-confirmation';
import { QueueType } from 'src/queue/model/queue-type.enum';

@Injectable()
export class AttentionReserveBuilder implements BuilderInterface {
  constructor(
    @InjectRepository(Attention)
    private attentionRepository = getRepository(Attention),
    private queueService: QueueService,
  ){}

  async create(
    queue: Queue,
    collaboratorId?: string,
    type?: AttentionType,
    channel?: string,
    userId?: string,
    block?: Block,
    date?: Date,
    paymentConfirmationData?: PaymentConfirmation,
    bookingId?: string,
    servicesId?: string[],
    servicesDetails?: object[],
    clientId?: string
  ): Promise<Attention> {
    if (!block) {
      throw new HttpException(`Intentando crear atención pero no tiene block`, HttpStatus.BAD_REQUEST);
    }
    let attention = new Attention();
    attention.status = AttentionStatus.PENDING;
    attention.type = type || AttentionType.STANDARD;
    attention.createdAt = date || new Date();
    attention.queueId = queue.id;
    attention.commerceId = queue.commerceId;
    const currentNumber = queue.currentNumber;
    let attentionNumber;
    if (block && Object.keys(block).length > 0 && queue.type !== QueueType.SELECT_SERVICE) {
      attentionNumber = block.number;
    } else {
      attention.number = currentNumber + 1;
    }
    if (block && block.number) {
      attention.number = block.number;
      attention.block = block;
    }
    if (queue.collaboratorId !== undefined) {
      attention.collaboratorId = queue.collaboratorId;
    }
    if (collaboratorId !== undefined) {
      attention.collaboratorId = collaboratorId;
    }
    attention.channel = channel;
    if (userId !== undefined) {
      attention.userId = userId;
    }
    const dateToCreate = date || new Date();
    const existingAttention = await this.getAttentionByNumberAndDate(attention.number, attention.queueId, dateToCreate);
    if (existingAttention && existingAttention.length > 0) {
      throw new HttpException(`Ya existe una atención con este numero para esta fecha ${attention.number} ${attention.queueId} ${dateToCreate}´`, HttpStatus.BAD_REQUEST);
    }
    if (queue.serviceId !== undefined) {
      attention.serviceId = queue.serviceId;
    }
    if (servicesId) {
      attention.servicesId = servicesId;
    }
    if (servicesDetails) {
      attention.servicesDetails = servicesDetails;
    }
    if (paymentConfirmationData !== undefined) {
      if (paymentConfirmationData.paid && paymentConfirmationData.paid === true) {
        attention.paymentConfirmationData = paymentConfirmationData;
        attention.paid = paymentConfirmationData.paid;
        attention.paidAt = paymentConfirmationData.paymentDate;
      }
    }
    if (bookingId != undefined) {
      attention.bookingId = bookingId;
    }
    if (clientId) {
      attention.clientId = clientId;
    }
    let attentionCreated = await this.attentionRepository.create(attention);
    queue.currentNumber = attentionCreated.number;
    if (queue.currentNumber === 1) {
      queue.currentAttentionId = attentionCreated.id;
      queue.currentAttentionNumber = attentionCreated.number;
    }
    await this.queueService.updateQueue('', queue);
    const attentionCreatedEvent = new AttentionCreated(new Date(), attentionCreated);
    publish(attentionCreatedEvent);

    return attentionCreated;
  }

  public async getAttentionByNumberAndDate(number: number, queueId: string, date: Date): Promise<Attention[]> {
    const startDate = date.toISOString().slice(0,10);
    const dateValue = new Date(startDate);
    return await this.attentionRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('number', number)
      .whereIn('status', [
        AttentionStatus.PENDING,
        AttentionStatus.PROCESSING,
        AttentionStatus.RATED,
        AttentionStatus.TERMINATED,
        AttentionStatus.REACTIVATED
      ])
      .whereGreaterOrEqualThan('createdAt', dateValue)
      .whereLessOrEqualThan('createdAt', dateValue)
      .orderByDescending('createdAt')
      .find();
  }
}