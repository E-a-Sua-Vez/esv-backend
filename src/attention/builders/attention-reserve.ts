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

@Injectable()
export class AttentionReserveBuilder implements BuilderInterface {
  constructor(
    @InjectRepository(Attention)
    private attentionRepository = getRepository(Attention),
    private queueService: QueueService,
  ){}

  async create(queue: Queue, collaboratorId?: string, type?: AttentionType, channel?: string, userId?: string, block?: Block): Promise<Attention> {
    if (!block) {
      throw new HttpException(`Intentando crear atención pero no tiene block`, HttpStatus.BAD_REQUEST);
    }
    let attention = new Attention();
    attention.status = AttentionStatus.PENDING;
    attention.type = type || AttentionType.STANDARD;
    attention.createdAt = new Date();
    attention.queueId = queue.id;
    attention.commerceId = queue.commerceId;
    if (block && block.number) {
      attention.number = block.number;
      attention.block = block;
    }
    if (collaboratorId !== undefined) {
      attention.collaboratorId = collaboratorId;
    }
    attention.channel = channel;
    if (userId !== undefined) {
      attention.userId = userId;
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
}