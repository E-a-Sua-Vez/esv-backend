import { Injectable } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { BuilderInterface } from '../../shared/interfaces/builder';
import { AttentionStatus } from '../model/attention-status.enum';
import { AttentionType } from '../model/attention-type.enum';
import { Attention } from '../model/attention.entity';
import { QueueService } from '../../queue/queue.service';
import { Queue } from '../../queue/model/queue.entity';
import AttentionCreated from '../events/AttentionCreated';
import { publish } from 'ett-events-lib';

@Injectable()
export class AttentionDefaultBuilder implements BuilderInterface {
  constructor(
    @InjectRepository(Attention)
    private attentionRepository = getRepository(Attention),
    private queueService: QueueService,
  ){}

  async create(
    queue: Queue,
    collaboratorId?: string,
    channel?: string,
    userId?: string,
    date?: Date,
    servicesId?: string[],
    servicesDetails?: object[],
    clientId?: string
  ): Promise<Attention> {
    const currentNumber = queue.currentNumber;
    let attention = new Attention();
    attention.status = AttentionStatus.PENDING;
    attention.type = AttentionType.STANDARD;
    attention.createdAt = date || new Date();
    attention.queueId = queue.id;
    attention.commerceId = queue.commerceId;
    attention.number = currentNumber + 1;
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
    if (queue.serviceId !== undefined) {
      attention.serviceId = queue.serviceId;
    }
    if (servicesId) {
      attention.servicesId = servicesId;
    }
    if (servicesDetails) {
      attention.servicesDetails = servicesDetails;
    }
    if (clientId) {
      attention.clientId = clientId;
    }
    let attentionCreated = await this.attentionRepository.create(attention);
    queue.currentNumber = attention.number;
    if (queue.currentNumber === 1) {
      queue.currentAttentionId = attentionCreated.id;
      queue.currentAttentionNumber = attention.number;
    }
    await this.queueService.updateQueue('', queue);

    const attentionCreatedEvent = new AttentionCreated(new Date(), attentionCreated);
    publish(attentionCreatedEvent);

    return attentionCreated;
  }
}