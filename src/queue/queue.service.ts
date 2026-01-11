import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable, Inject } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { firstValueFrom } from 'rxjs';
import { timeConvert } from 'src/shared/utils/date';

import { ServiceService } from '../service/service.service';
import { GcpLoggerService } from '../shared/logger/gcp-logger.service';

import { QueueDetailsDto } from './dto/queue-details.dto';
import QueueCreated from './events/QueueCreated';
import QueueUpdated from './events/QueueUpdated';
import { QueueType } from './model/queue-type.enum';
import { Block, Queue, ServiceInfo } from './model/queue.entity';

@Injectable()
export class QueueService {
  private readonly queryStackUrl = process.env.QUERY_APP_BACKEND_URL || 'http://localhost:3003';

  constructor(
    @InjectRepository(Queue)
    private queueRepository = getRepository(Queue),
    private serviceService: ServiceService,
    private httpService: HttpService,
    @Inject(GcpLoggerService)
    private readonly logger: GcpLoggerService
  ) {
    this.logger.setContext('QueueService');
  }

  public async getQueueById(id: string): Promise<Queue> {
    const queue = await this.queueRepository.findById(id);
    if (!queue) {
      this.logger.warn('Queue not found', { queueId: id });
      throw new HttpException(`No se encontro la cola`, HttpStatus.NOT_FOUND);
    }
    // Ensure backward compatibility: if presentialEnabled is not defined, default to true
    if (queue.presentialEnabled === undefined || queue.presentialEnabled === null) {
      queue.presentialEnabled = true;
    }
    return this.getQueueBlockDetails(queue);
  }

  public async getQueues(): Promise<Queue[]> {
    const queues: Queue[] = [];
    const result = await this.queueRepository.find();
    if (result && result.length > 0) {
      result.forEach(queue => {
        if (queue.presentialEnabled === undefined || queue.presentialEnabled === null) {
          queue.presentialEnabled = true;
        }
        queues.push(this.getQueueBlockDetails(queue));
      });
    }
    return queues;
  }

  public async getQueueByCommerce(commerceId: string): Promise<Queue[]> {
    const queues: Queue[] = [];
    const result = await this.queueRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('available', true)
      .orderByAscending('order')
      .find();
    if (result && result.length > 0) {
      result.forEach(queue => {
        if (queue.presentialEnabled === undefined || queue.presentialEnabled === null) {
          queue.presentialEnabled = true;
        }
        queues.push(this.getQueueBlockDetails(queue));
      });
    }
    return queues;
  }

  public async getGroupedQueueByCommerce(
    commerceId: string
  ): Promise<Record<string, QueueDetailsDto[]>> {
    let groupedQueues = {};
    const queues: QueueDetailsDto[] = [];
    const result = await this.getActiveOnlineQueuesByCommerce(commerceId);
    if (result && result.length > 0) {
      for (let i = 0; i < result.length; i++) {
        const queueDetailsDto: QueueDetailsDto = new QueueDetailsDto();
        const queue = result[i];
        if ([QueueType.SERVICE, QueueType.MULTI_SERVICE].includes(queue.type)) {
          queue.services = await this.serviceService.getServicesById(
            queue.servicesId || [queue.serviceId]
          );
        }
        queueDetailsDto.id = queue.id;
        queueDetailsDto.commerceId = queue.commerceId;
        queueDetailsDto.collaboratorId = queue.collaboratorId;
        queueDetailsDto.type = queue.type;
        queueDetailsDto.active = queue.active;
        queueDetailsDto.available = queue.available;
        queueDetailsDto.online = queue.online;
        queueDetailsDto.limit = queue.limit;
        queueDetailsDto.name = queue.name;
        queueDetailsDto.tag = queue.tag;
        queueDetailsDto.order = queue.order;
        queueDetailsDto.estimatedTime = queue.estimatedTime;
        queueDetailsDto.blockTime = queue.blockTime;
        queueDetailsDto.serviceId = queue.serviceId;
        queueDetailsDto.serviceInfo = queue.serviceInfo;
        queueDetailsDto.servicesId = queue.servicesId;
        queueDetailsDto.services = queue.services;
        queueDetailsDto.telemedicineEnabled = queue.telemedicineEnabled || false; // Default to false for backward compatibility
        // Default presentialEnabled to true for backward compatibility
        queueDetailsDto.presentialEnabled =
          queue.presentialEnabled === undefined || queue.presentialEnabled === null
            ? true
            : queue.presentialEnabled;
        queues.push(queueDetailsDto);
      }
      if (queues && queues.length > 0) {
        groupedQueues = queues.reduce((acc, conf) => {
          const type = conf.type;
          if (!acc[type]) {
            acc[type] = [];
          }
          acc[type].push(conf);
          return acc;
        }, {});
      }
    }
    return groupedQueues;
  }

  public async getActiveQueuesByCommerce(commerceId: string): Promise<Queue[]> {
    const queues: Queue[] = [];
    const result = await this.queueRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .orderByAscending('order')
      .find();
    if (result && result.length > 0) {
      for (let i = 0; i < result.length; i++) {
        const queue = result[i];
        if (queue.type === QueueType.SERVICE) {
          if (queue.serviceId) {
            queue.services = await this.serviceService.getServicesById([queue.serviceId]);
          }
        }
        if (queue.presentialEnabled === undefined || queue.presentialEnabled === null) {
          queue.presentialEnabled = true;
        }
        queues.push(this.getQueueBlockDetails(queue));
      }
    }
    return queues;
  }

  public async getActiveOnlineQueuesByCommerce(commerceId: string): Promise<Queue[]> {
    let queues: Queue[] = [];
    queues = await this.queueRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .whereEqualTo('online', true)
      .orderByAscending('order')
      .find();
    if (queues && queues.length > 0) {
      queues = queues.map(queue => {
        if (queue.presentialEnabled === undefined || queue.presentialEnabled === null) {
          queue.presentialEnabled = true;
        }
        return queue;
      });
    }
    return queues;
  }

  public async updateQueueConfigurations(
    user,
    id,
    name,
    limit,
    estimatedTime,
    order,
    active,
    available,
    online,
    serviceInfo,
    blockTime = 60,
    servicesId,
    telemedicineEnabled?: boolean,
    presentialEnabled?: boolean
  ): Promise<Queue> {
    try {
      const queue = await this.queueRepository.findById(id);
      if (name) {
        queue.name = name;
      }
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
      if (available !== undefined) {
        queue.available = available;
      }
      if (online !== undefined) {
        queue.online = online;
      }
      if (serviceInfo !== undefined) {
        queue.serviceInfo = serviceInfo;
      }
      if (blockTime !== undefined) {
        queue.blockTime = blockTime;
      }
      if (servicesId !== undefined) {
        queue.servicesId = servicesId;
      }
      if (telemedicineEnabled !== undefined) {
        queue.telemedicineEnabled = telemedicineEnabled;
      }
       if (presentialEnabled !== undefined) {
         queue.presentialEnabled = presentialEnabled;
       }
      const updatedQueue = await this.update(user, queue);
      this.logger.info('Queue configuration updated', {
        queueId: id,
        commerceId: queue.commerceId,
        name,
        limit,
        active,
        available,
        online,
        user,
      });
      return updatedQueue;
    } catch (error) {
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        queueId: id,
        user,
        operation: 'updateQueueConfigurations',
      });
      throw new HttpException(
        `Hubo un problema al modificar la fila: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async update(user: string, queue: Queue): Promise<Queue> {
    const queueUpdated = await this.queueRepository.update(queue);
    const queueUpdatedEvent = new QueueUpdated(new Date(), queueUpdated, { user });
    publish(queueUpdatedEvent);
    return queueUpdated;
  }

  public async updateQueue(user: string, queue: Queue): Promise<Queue> {
    const queueUpdated = await this.queueRepository.update(queue);
    return queueUpdated;
  }

  public async createQueue(
    user: string,
    commerceId: string,
    type: QueueType,
    name: string,
    tag: string,
    limit: number,
    estimatedTime: number,
    order: number,
    serviceInfo: ServiceInfo,
    blockTime = 60,
    collaboratorId: string,
    serviceId: string,
    servicesId: string[],
    telemedicineEnabled?: boolean,
    presentialEnabled?: boolean
  ): Promise<Queue> {
    const queue = new Queue();
    queue.commerceId = commerceId;
    queue.type = type || QueueType.STANDARD;
    queue.name = name;
    queue.limit = limit;
    queue.estimatedTime = estimatedTime;
    queue.currentNumber = 0;
    queue.currentAttentionNumber = 0;
    queue.currentAttentionId = '';
    queue.active = true;
    queue.available = true;
    queue.online = true;
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
    if (servicesId) {
      queue.servicesId = servicesId;
    }
    queue.tag = name;
    if (tag) {
      queue.tag = tag;
    }
    queue.telemedicineEnabled = telemedicineEnabled || false; // Default to false for backward compatibility
    // Default presentialEnabled to true for backward compatibility
    if (presentialEnabled === undefined || presentialEnabled === null) {
      queue.presentialEnabled = true;
    } else {
      queue.presentialEnabled = presentialEnabled;
    }
    const queueCreated = await this.queueRepository.create(queue);
    const queueCreatedEvent = new QueueCreated(new Date(), queueCreated, { user });
    publish(queueCreatedEvent);
    this.logger.info('Queue created successfully', {
      queueId: queueCreated.id,
      commerceId,
      type,
      name,
      limit,
      collaboratorId,
      serviceId,
      hasServicesId: !!servicesId && servicesId.length > 0,
      user,
    });
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
      this.logger.info('All queues restarted', {
        queuesCount: queues.length,
      });
    } catch (error) {
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        operation: 'restartAll',
      });
      throw new HttpException(
        `Hubo un problema al reiniciar las filas: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return 'Las filas fueron reiniciadas exitosamente';
  }

  public async getEstimatedWaitTime(
    queueId: string,
    positionInQueue: number,
    method: 'average' | 'median' | 'p75' = 'p75'
  ): Promise<number> {
    try {
      const queue = await this.getQueueById(queueId);

      // Try to get intelligent estimation from query-stack
      try {
        const url = `${this.queryStackUrl}/attention/queue/${queueId}/estimated-duration?method=${method}&days=30&limit=30`;
        const response = await firstValueFrom(this.httpService.get(url));

        if (
          response.data &&
          response.data.success &&
          response.data.duration &&
          response.data.duration > 0
        ) {
          const estimatedMinutes = response.data.duration * positionInQueue;
          this.logger.info('Using intelligent estimation', {
            queueId,
            method,
            duration: response.data.duration,
            positionInQueue,
            estimatedMinutes,
          });
          return estimatedMinutes;
        }
      } catch (error) {
        this.logger.warn('Failed to get intelligent estimation, using fallback', {
          queueId,
          error: error.message,
        });
      }

      // Fallback to hardcoded value
      const hardcodedEstimatedTime = queue.estimatedTime || 5; // Default to 5 minutes if not set
      const estimatedMinutes = hardcodedEstimatedTime * positionInQueue;

      this.logger.info('Using hardcoded estimation', {
        queueId,
        hardcodedEstimatedTime,
        positionInQueue,
        estimatedMinutes,
      });

      return estimatedMinutes;
    } catch (error) {
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        queueId,
        operation: 'getEstimatedWaitTime',
      });

      // Final fallback: return a default value
      return 5 * positionInQueue;
    }
  }

  private getQueueBlockDetails(queue: Queue): Queue {
    let hourBlocks: Block[] = [];
    if (
      queue.blockTime &&
      queue.serviceInfo &&
      queue.serviceInfo.attentionHourFrom &&
      queue.serviceInfo.attentionHourTo
    ) {
      if (!queue.serviceInfo.break) {
        const minsFrom = queue.serviceInfo.attentionHourFrom * 60;
        const minsTo = queue.serviceInfo.attentionHourTo * 60;
        const minsTotal = minsTo - minsFrom;
        const blocksAmount = Math.floor(minsTotal / queue.blockTime);
        const blocks = [];
        for (let i = 1; i <= blocksAmount; i++) {
          const block: Block = {
            number: i,
            hourFrom: timeConvert(minsFrom + queue.blockTime * (i - 1)),
            hourTo: timeConvert(minsFrom + queue.blockTime * i),
          };
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
        for (let i = 1; i <= blocksAmount1; i++) {
          const block: Block = {
            number: countBlock,
            hourFrom: timeConvert(minsFrom1 + queue.blockTime * (i - 1)),
            hourTo: timeConvert(minsFrom1 + queue.blockTime * i),
          };
          blocks.push(block);
          countBlock++;
        }
        for (let i = 1; i <= blocksAmount2; i++) {
          const block: Block = {
            number: countBlock,
            hourFrom: timeConvert(minsFrom2 + queue.blockTime * (i - 1)),
            hourTo: timeConvert(minsFrom2 + queue.blockTime * i),
          };
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
