import { Injectable } from '@nestjs/common';
import { CommerceService } from 'src/commerce/commerce.service';
import { Commerce } from 'src/commerce/model/commerce.entity';
import { Queue } from 'src/queue/model/queue.entity';
import { QueueService } from 'src/queue/queue.service';
import { timeConvert } from 'src/shared/utils/date';
import { Block } from './model/block.entity';

@Injectable()
export class BlockService {
  constructor(
    private readonly commerceService: CommerceService,
    private readonly queueService: QueueService
  ) {}

  public async getQueueBlockDetails(queueId: string): Promise<Block[]> {
    let serviceInfo;
    let blockTime;
    const queue = await this.queueService.getQueueById(queueId);
    if (queue.blockTime) {
      blockTime = queue.blockTime;
    }
    if (queue.serviceInfo &&
      queue.serviceInfo.sameCommeceHours === true) {
      const commerce = await this.commerceService.getCommerceById(queue.commerceId);
      if (commerce.serviceInfo) {
        serviceInfo = commerce.serviceInfo;
      }
    } else if (queue.serviceInfo &&
      queue.serviceInfo.sameCommeceHours === false) {
      serviceInfo = queue.serviceInfo;
    }
    return this.buildBlocks(blockTime, serviceInfo);
  }

  private buildBlocks(blockTime: number, serviceInfo: any): Block[] {
    let hourBlocks: Block[] = [];
    let attentionHourFrom = serviceInfo.attentionHourFrom;
    let attentionHourTo = serviceInfo.attentionHourTo;
    let breakHourFrom = serviceInfo.breakHourFrom;
    let breakHourTo = serviceInfo.breakHourTo;
    let isBreak = serviceInfo.break;

    if (blockTime && attentionHourFrom >= 0 && attentionHourTo >= 0) {
      if (isBreak === false) {
        const minsFrom = attentionHourFrom * 60;
        const minsTo = attentionHourTo * 60;
        const minsTotal = minsTo - minsFrom;
        const blocksAmount = Math.floor(minsTotal / blockTime);
        const blocks = [];
        for(let i = 1; i <= blocksAmount; i ++) {
          const block: Block = {
            number: i,
            hourFrom: timeConvert((minsFrom + (blockTime * (i - 1)))),
            hourTo: timeConvert((minsFrom + (blockTime * i))),
          }
          blocks.push(block);
        }
        hourBlocks = blocks;
      } else {
        const minsFrom1 = attentionHourFrom * 60;
        const minsTo1 = breakHourFrom * 60;
        const minsFrom2 = breakHourTo * 60;
        const minsTo2 = attentionHourTo * 60;
        const minsTotal1 = minsTo1 - minsFrom1;
        const minsTotal2 = minsTo2 - minsFrom2;
        const blocksAmount1 = Math.floor(minsTotal1 / blockTime);
        const blocksAmount2 = Math.floor(minsTotal2 / blockTime);
        const blocks: Block[] = [];
        let countBlock = 1;
        for(let i = 1; i <= blocksAmount1; i ++) {
          const block: Block = {
            number: countBlock,
            hourFrom: timeConvert((minsFrom1 + (blockTime * (i - 1)))),
            hourTo: timeConvert((minsFrom1 + (blockTime * i))),
          }
          blocks.push(block);
          countBlock++;
        }
        for(let i = 1; i <= blocksAmount2; i ++) {
          const block: Block = {
            number: countBlock,
            hourFrom: timeConvert((minsFrom2 + (blockTime * (i - 1)))),
            hourTo: timeConvert((minsFrom2 + (blockTime * i))),
          }
          blocks.push(block);
          countBlock++;
        }
        hourBlocks = blocks;
      }
    }
    return hourBlocks;
  }

  public async getQueueBlockDetailsByDay(queueId: string): Promise<Record<string, Block[]>> {
    let blocksByDay;
    const queue = await this.queueService.getQueueById(queueId);
    if (queue) {
      const commerce = await this.commerceService.getCommerceById(queue.commerceId);
      if (commerce) {
        blocksByDay = await this.getCommerceQueueBlockDetailsByDay(commerce, queue);
      }
    }
    return blocksByDay;
  }

  public async getCommerceQueueBlockDetailsByDay(commerce: Commerce, queue: Queue): Promise<Record<string, Block[]>> {
    let hourBlocks: Block[] = [];
    let blocksByDay = {};
    let serviceInfo;
    let blockTime;
    if (queue.blockTime) {
      blockTime = queue.blockTime;
    }
    if (queue.serviceInfo &&
      queue.serviceInfo.sameCommeceHours === true) {
      if (commerce.serviceInfo) {
        serviceInfo = commerce.serviceInfo;
      }
    } else if (queue.serviceInfo &&
      queue.serviceInfo.sameCommeceHours === false) {
      serviceInfo = queue.serviceInfo;
    }

    if (serviceInfo && serviceInfo.personalized === false) {
      hourBlocks = await this.buildBlocks(blockTime, serviceInfo);
      [1,2,3,4,5,6,7].map(key => blocksByDay[key] = hourBlocks);
    } else if (serviceInfo && serviceInfo.personalized === true) {
      if (serviceInfo.attentionDays && serviceInfo.attentionDays.length >= 1) {
        serviceInfo.attentionDays.map(key => {
          let hourBlocks;
          if (serviceInfo.personalizedHours) {
            const block = serviceInfo.personalizedHours[key];
            serviceInfo.attentionHourFrom = block.attentionHourFrom;
            serviceInfo.attentionHourTo = block.attentionHourTo;
            hourBlocks = this.buildBlocks(blockTime, serviceInfo);
            blocksByDay[key] = hourBlocks
          }
        });
      }
    }
    return blocksByDay;
  }


  public async getQueueBlockDetailsByDayByCommerceId(commerceId: string): Promise<Record<string, Record<string, Block[]>>> {
    const result = {};
    const commerce = await this.commerceService.getCommerceById(commerceId);
    const queues = commerce.queues;
    if (queues && queues.length > 0) {
      for (let i = 0; i < queues.length; i++) {
        const queue = queues[i];
        const blocks = await this.getCommerceQueueBlockDetailsByDay(commerce, queue);
        result[queue.id] = blocks;
      }
    }
    return result;
  }

  public async getQueueBlockDetailsBySpecificDayByCommerceId(commerceId: string, queueId: string): Promise<Record<string, Block[]>> {
    const result = {};
    const commerce = await this.commerceService.getCommerceById(commerceId);
    const queues = commerce.queues.filter(queue => queue.id === queueId);
    if (queues && queues.length > 0) {
      const queue = queues[0];
      let blockTime;
      let serviceInfo;
      if (queue && queue.id) {
        if (queue.blockTime) {
          blockTime = queue.blockTime;
        }
        if (commerce.serviceInfo) {
          serviceInfo = commerce.serviceInfo;
        }
        if (serviceInfo && serviceInfo.specificCalendar === true) {
          const dates = Object.keys(serviceInfo.specificCalendarDays);
          if (dates && dates.length > 0) {
            dates.map(date => {
              const block = serviceInfo.specificCalendarDays[date];
              const serviceInfoToBuild = {
                attentionHourFrom: block.attentionHourFrom,
                attentionHourTo: block.attentionHourTo,
                break: false
              };
              result[date] = this.buildBlocks(blockTime, serviceInfoToBuild);
            })
          }
        }
      }
    }
    return result;
  }
}