import { Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { Queue } from '../../queue/model/queue.entity';
import { QueueService } from '../../queue/queue.service';
import { BuilderInterface } from '../../shared/interfaces/builder';
import AttentionCreated from '../events/AttentionCreated';
import { AttentionStatus } from '../model/attention-status.enum';
import { AttentionType } from '../model/attention-type.enum';
import { Attention } from '../model/attention.entity';

@Injectable()
export class AttentionNoDeviceBuilder implements BuilderInterface {
  constructor(
    @InjectRepository(Attention)
    private attentionRepository = getRepository(Attention),
    private queueService: QueueService
  ) {}

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
    const attention = new Attention();
    attention.status = AttentionStatus.PENDING;
    attention.type = AttentionType.NODEVICE;
    attention.createdAt = date || new Date();
    attention.queueId = queue.id;
    attention.commerceId = queue.commerceId;
    attention.number = currentNumber + 1;
    if (queue.professionalId !== undefined) {
      attention.collaboratorId = queue.professionalId; // Attention usa collaboratorId para referirse al profesional que registra
    } else if (queue.collaboratorId !== undefined) {
      // Compatibilidad temporal: si aún no migrado, usar collaboratorId del queue
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
    const attentionCreated = await this.attentionRepository.create(attention);
    queue.currentNumber = attention.number;
    // Set currentAttentionNumber when it's the first attention or when it's not set
    if (
      queue.currentNumber === 1 ||
      !queue.currentAttentionNumber ||
      queue.currentAttentionNumber === 0
    ) {
      queue.currentAttentionId = attentionCreated.id;
      queue.currentAttentionNumber = attention.number;
    }
    await this.queueService.updateQueue('', queue);

    // Use attention.createdAt for occurredOn to preserve historical dates
    // Falls back to new Date() for backward compatibility if createdAt is not set
    const attentionCreatedEvent = new AttentionCreated(
      attentionCreated.createdAt || new Date(),
      attentionCreated
    );
    publish(attentionCreatedEvent);

    return attentionCreated;
  }
}
