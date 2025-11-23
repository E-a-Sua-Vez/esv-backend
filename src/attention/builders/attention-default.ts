import { Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { PackageStatus } from 'src/package/model/package-status.enum';
import { PackageType } from 'src/package/model/package-type.enum';
import { PackageService } from 'src/package/package.service';
import { ServiceService } from 'src/service/service.service';

import { Queue } from '../../queue/model/queue.entity';
import { QueueService } from '../../queue/queue.service';
import { BuilderInterface } from '../../shared/interfaces/builder';
import AttentionCreated from '../events/AttentionCreated';
import { AttentionStatus } from '../model/attention-status.enum';
import { AttentionType } from '../model/attention-type.enum';
import { Attention } from '../model/attention.entity';

@Injectable()
export class AttentionDefaultBuilder implements BuilderInterface {
  constructor(
    @InjectRepository(Attention)
    private attentionRepository = getRepository(Attention),
    private queueService: QueueService,
    private serviceService: ServiceService,
    private packageService: PackageService
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
    const attentionCreated = await this.attentionRepository.create(attention);
    if (attentionCreated.servicesId && attentionCreated.servicesId.length === 1) {
      const service = await this.serviceService.getServiceById(attentionCreated.servicesId[0]);
      if (
        service &&
        service.id &&
        service.serviceInfo &&
        service.serviceInfo.procedures &&
        service.serviceInfo.procedures > 1
      ) {
        if (attentionCreated.clientId) {
          const packs = await this.packageService.getPackageByCommerceIdAndClientServices(
            attentionCreated.commerceId,
            attentionCreated.clientId,
            attentionCreated.servicesId[0]
          );
          if (packs && packs.length === 0) {
            const packageName = service.tag.toLocaleUpperCase();
            const packCreated = await this.packageService.createPackage(
              'ett',
              attentionCreated.commerceId,
              attentionCreated.clientId,
              undefined,
              attentionCreated.id,
              service.serviceInfo.procedures,
              packageName,
              attentionCreated.servicesId,
              [],
              [attentionCreated.id],
              PackageType.STANDARD,
              PackageStatus.REQUESTED
            );
            attention.packageId = packCreated.id;
            await this.attentionRepository.update(attention);
          }
        }
      }
    }
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
