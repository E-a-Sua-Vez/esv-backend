import { Block, Queue, ServiceInfo } from './model/queue.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import QueueCreated from './events/QueueCreated';
import QueueUpdated from './events/QueueUpdated';
import { timeConvert } from 'src/shared/utils/date';
import { QueueType } from './model/queue-type.enum';

@Injectable()
export class QueueService {
  constructor(
  @InjectRepository(Queue)
    private queueRepository = getRepository(Queue)
  ) {}

  public async getQueueById(id: string): Promise<Queue> {
    let queue = await this.queueRepository.findById(id);
    return this.getQueueBlockDetails(queue);
  }

  public async getQueues(): Promise<Queue[]> {
    let queues: Queue[] = [];
    const result = await this.queueRepository.find();
    result.forEach(queue => {
      queues.push(this.getQueueBlockDetails(queue));
    })
    return queues;
  }

  public async getQueueByCommerce(commerceId: string): Promise<Queue[]> {
    let queues: Queue[] = [];
    const result = await this.queueRepository.whereEqualTo('commerceId', commerceId)
      .orderByAscending('order')
      .find();
    result.forEach(queue => {
      queues.push(this.getQueueBlockDetails(queue));
    })
    return queues;
  }

  public async getGroupedQueueByCommerce(commerceId: string): Promise<Record<string, Queue[]>> {
    let grupedQueues = {};
    let queues: Queue[] = [];
    const result = await this.queueRepository.whereEqualTo('commerceId', commerceId)
      .orderByAscending('order')
      .find();
    result.forEach(queue => {
      queues.push(this.getQueueBlockDetails(queue));
    })
    if (queues && queues.length > 0) {
      grupedQueues = queues.reduce((acc, conf) => {
        const type = conf.type;
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(conf);
        return acc;
      }, {});
    }
    return grupedQueues;
  }

  public async getActiveQueuesByCommerce(commerceId: string): Promise<Queue[]> {
    let queues: Queue[] = [];
    const result = await this.queueRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('active', true)
      .orderByAscending('order')
      .find();
    result.forEach(queue => {
      queues.push(this.getQueueBlockDetails(queue));
    })
    return queues;
  }

  public async updateQueueConfigurations(user, id, limit, estimatedTime, order, active, serviceInfo, blockTime = 60): Promise<Queue> {
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
      if (blockTime !== undefined) {
        queue.blockTime = blockTime;
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

  public async createQueue(user: string, commerceId: string, type: QueueType, name: string, tag: string, limit: number, estimatedTime: number, order: number, serviceInfo: ServiceInfo, blockTime: number = 60, collaboratorId: string, serviceId: string): Promise<Queue> {
    let queue = new Queue();
    queue.commerceId = commerceId;
    queue.type = type || QueueType.STANDARD;
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
    queue.blockTime = blockTime;
    if (collaboratorId) {
      queue.collaboratorId = collaboratorId;
    }
    if (serviceId) {
      queue.serviceId = serviceId;
    }
    queue.tag = tag;
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

  private getQueueBlockDetails(queue: Queue): Queue {
    let hourBlocks: Block[] = [];
    if (queue.blockTime &&
      queue.serviceInfo &&
      queue.serviceInfo.attentionHourFrom &&
      queue.serviceInfo.attentionHourTo) {
      if (!queue.serviceInfo.break) {
        const minsFrom = queue.serviceInfo.attentionHourFrom * 60;
        const minsTo = queue.serviceInfo.attentionHourTo * 60;
        const minsTotal = minsTo - minsFrom;
        const blocksAmount = Math.floor(minsTotal / queue.blockTime);
        const blocks = [];
        for(let i = 1; i <= blocksAmount; i ++) {
          const block: Block = {
            number: i,
            hourFrom: timeConvert((minsFrom + (queue.blockTime * (i - 1)))),
            hourTo: timeConvert((minsFrom + (queue.blockTime * i))),
          }
          blocks.push(block);
        }
        hourBlocks = blocks;
      } else {
        const minsFrom1 = queue.serviceInfo.attentionHourFrom * 60;
        const minsTo1 = queue.serviceInfo.breakHourFrom * 60;
        const minsFrom2 = queue.serviceInfo.breakHourTo * 60;
        const minsTo2 = queue.serviceInfo.attentionHourTo * 60;
        const minsTotal1 = minsTo1 - minsFrom1;
        const minsTotal2 = minsTo2 - minsFrom2;
        const blocksAmount1 = Math.floor(minsTotal1 / queue.blockTime);
        const blocksAmount2 = Math.floor(minsTotal2 / queue.blockTime);
        const blocks: Block[] = [];
        let countBlock = 1;
        for(let i = 1; i <= blocksAmount1; i ++) {
          const block: Block = {
            number: countBlock,
            hourFrom: timeConvert((minsFrom1 + (queue.blockTime * (i - 1)))),
            hourTo: timeConvert((minsFrom1 + (queue.blockTime * i))),
          }
          blocks.push(block);
          countBlock++;
        }
        for(let i = 1; i <= blocksAmount2; i ++) {
          const block: Block = {
            number: countBlock,
            hourFrom: timeConvert((minsFrom2 + (queue.blockTime * (i - 1)))),
            hourTo: timeConvert((minsFrom2 + (queue.blockTime * i))),
          }
          blocks.push(block);
          countBlock++;
        }
        hourBlocks = blocks;
      }
      queue.serviceInfo.blocks = hourBlocks;
    }
    return queue;
  }


}
