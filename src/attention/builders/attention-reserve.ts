import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { PackageStatus } from 'src/package/model/package-status.enum';
import { PackageType } from 'src/package/model/package-type.enum';
import { PackageService } from 'src/package/package.service';
import { PaymentConfirmation } from 'src/payment/model/payment-confirmation';
import { QueueType } from 'src/queue/model/queue-type.enum';
import { ServiceService } from 'src/service/service.service';

import { Queue } from '../../queue/model/queue.entity';
import { QueueService } from '../../queue/queue.service';
import { BuilderInterface } from '../../shared/interfaces/builder';
import AttentionCreated from '../events/AttentionCreated';
import { AttentionStatus } from '../model/attention-status.enum';
import { AttentionType } from '../model/attention-type.enum';
import { Attention, Block } from '../model/attention.entity';

@Injectable()
export class AttentionReserveBuilder implements BuilderInterface {
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
    type?: AttentionType,
    channel?: string,
    userId?: string,
    block?: Block,
    date?: Date,
    paymentConfirmationData?: PaymentConfirmation,
    bookingId?: string,
    servicesId?: string[],
    servicesDetails?: object[],
    clientId?: string,
    termsConditionsToAcceptCode?: string,
    termsConditionsAcceptedCode?: string,
    termsConditionsToAcceptedAt?: Date
  ): Promise<Attention> {
    if (!block) {
      throw new HttpException(
        `Intentando crear atención pero no tiene block`,
        HttpStatus.BAD_REQUEST
      );
    }
    const attention = new Attention();
    attention.status = AttentionStatus.PENDING;
    attention.type = type || AttentionType.STANDARD;
    attention.createdAt = date || new Date();
    attention.queueId = queue.id;
    attention.commerceId = queue.commerceId;
    const currentNumber = queue.currentNumber;
    if (block && Object.keys(block).length > 0 && queue.type !== QueueType.SELECT_SERVICE) {
      // attentionNumber is set from block.number but not used
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
    if (termsConditionsToAcceptCode !== undefined) {
      attention.termsConditionsToAcceptCode = termsConditionsToAcceptCode;
    }
    if (termsConditionsAcceptedCode !== undefined) {
      attention.termsConditionsAcceptedCode = termsConditionsAcceptedCode;
    }
    if (termsConditionsToAcceptedAt !== undefined) {
      attention.termsConditionsToAcceptedAt = termsConditionsToAcceptedAt;
    }
    const dateToCreate = date || new Date();
    const existingAttention = await this.getAttentionByNumberAndDate(
      attention.number,
      attention.queueId,
      dateToCreate
    );
    if (existingAttention && existingAttention.length > 0) {
      throw new HttpException(
        `Ya existe una atención con este numero para esta fecha ${attention.number} ${attention.queueId} ${dateToCreate}´`,
        HttpStatus.BAD_REQUEST
      );
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
        attention.confirmed = true;
        attention.confirmedAt = new Date();
      }
    }
    if (bookingId != undefined) {
      attention.bookingId = bookingId;
    }
    if (clientId) {
      attention.clientId = clientId;
    }
    const attentionCreated = await this.attentionRepository.create(attention);
    if (paymentConfirmationData && paymentConfirmationData.packageId) {
      attention.packageId = paymentConfirmationData.packageId;
      attention.packageProceduresTotalNumber = paymentConfirmationData.proceduresTotalNumber;
      attention.packageProcedureNumber = paymentConfirmationData.procedureNumber;
    } else {
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
    }
    queue.currentNumber = attentionCreated.number;
    if (queue.currentNumber === 1) {
      queue.currentAttentionId = attentionCreated.id;
      queue.currentAttentionNumber = attentionCreated.number;
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

  public async getAttentionByNumberAndDate(
    number: number,
    queueId: string,
    date: Date
  ): Promise<Attention[]> {
    const startDate = date.toISOString().slice(0, 10);
    const dateValue = new Date(startDate);
    return await this.attentionRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('number', number)
      .whereIn('status', [
        AttentionStatus.PENDING,
        AttentionStatus.PROCESSING,
        AttentionStatus.RATED,
        AttentionStatus.TERMINATED,
        AttentionStatus.REACTIVATED,
      ])
      .whereGreaterOrEqualThan('createdAt', dateValue)
      .whereLessOrEqualThan('createdAt', dateValue)
      .orderByDescending('createdAt')
      .find();
  }
}
