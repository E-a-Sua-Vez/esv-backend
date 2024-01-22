import { Queue, ServiceInfo } from './queue.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import QueueCreated from './events/QueueCreated';
import QueueUpdated from './events/QueueUpdated';

@Injectable()
export class QueueService {
  constructor(
  @InjectRepository(Queue)
    private queueRepository = getRepository(Queue)
  ) {}

  public async getQueueById(id: string): Promise<Queue> {
    return await this.queueRepository.findById(id);
  }

  public async getQueues(): Promise<Queue[]> {
    return await this.queueRepository.find();
  }

  public async getQueueByCommerce(commerceId: string): Promise<Queue[]> {
    return await this.queueRepository.whereEqualTo('commerceId', commerceId)
      .orderByAscending('order')
      .find();
  }

  public async getActiveQueuesByCommerce(commerceId: string): Promise<Queue[]> {
    return await this.queueRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('active', true)
      .orderByAscending('order')
      .find();
  }

  public async updateQueueConfigurations(user, id, limit, estimatedTime, order, active, serviceInfo): Promise<Queue> {
    try {
      let queue = await this.queueRepository.findById(id);
      if (limit) {
        queue.limit = limit;
      }
      if (estimatedTime) {
        queue.estimatedTime = estimatedTime;
      }
      if (order) {
        queue.order = order;
      }
      if (active !== undefined) {
        queue.active = active;
      }
      if (serviceInfo !== undefined) {
        queue.serviceInfo = serviceInfo;
      }
      return await this.updateQueue(user, queue);
    }catch(error) {
      throw `Hubo un problema al modificar la fila: ${error.message}`;
    }
  }

  public async updateQueue(user: string, queue: Queue): Promise<Queue> {
    const queueUpdated = await await this.queueRepository.update(queue);
    const queueUpdatedEvent = new QueueUpdated(new Date(), queueUpdated, { user });
    publish(queueUpdatedEvent);
    return queueUpdated;
  }

  public async createQueue(user: string, commerceId: string, name: string, limit: number, estimatedTime: number, order: number, serviceInfo: ServiceInfo): Promise<Queue> {
    let queue = new Queue();
    queue.commerceId = commerceId;
    queue.name = name;
    queue.limit = limit;
    queue.estimatedTime = estimatedTime;
    queue.currentNumber = 0;
    queue.currentAttentionNumber = 0;
    queue.currentAttentionId = '';
    queue.active = true;
    queue.createdAt = new Date();
    queue.order = order;
    queue.serviceInfo = serviceInfo;
    const queueCreated = await this.queueRepository.create(queue);
    const queueCreatedEvent = new QueueCreated(new Date(), queueCreated, { user });
    publish(queueCreatedEvent);
    return queueCreated;
  }

  public async restartAll(): Promise<string> {
    try {
      const queues = await this.queueRepository.find();
      queues.forEach(async queue => {
        queue.currentAttentionNumber = 0;
        queue.currentNumber = 0;
        queue.currentAttentionId = '';
        await this.queueRepository.update(queue);
      });
    } catch(error) {
      throw `Hubo un problema al reiniciar las filas: ${error.message}`;
    }
    return 'Las filas fueron reiniciadas exitosamente';
  }
}
