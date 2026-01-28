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
    clientId?: string,
    paymentConfirmationData?: any // Agregar parámetro de datos de pago
  ): Promise<Attention> {
    const currentNumber = queue.currentNumber;
    const attention = new Attention();
    attention.status = AttentionStatus.PENDING;
    attention.type = AttentionType.STANDARD;
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
    if (attentionCreated.servicesId && attentionCreated.servicesId.length === 1) {
      const service = await this.serviceService.getServiceById(attentionCreated.servicesId[0]);

      // Determine procedures amount: from servicesDetails first, then service.serviceInfo.procedures, then service.serviceInfo.proceduresList
      let proceduresAmount = 0;
      console.log('[AttentionDefaultBuilder] Determining procedures amount:', {
        servicesDetails: servicesDetails,
        servicesDetailsLength: servicesDetails?.length,
        firstServiceDetails: servicesDetails?.[0],
        proceduresInDetails: servicesDetails?.[0]?.['procedures'],
        serviceProcedures: service?.serviceInfo?.procedures,
        serviceProceduresList: service?.serviceInfo?.proceduresList,
      });

      if (servicesDetails && servicesDetails.length > 0 && servicesDetails[0]['procedures']) {
        proceduresAmount =
          parseInt(servicesDetails[0]['procedures'], 10) || servicesDetails[0]['procedures'];
        console.log(
          '[AttentionDefaultBuilder] Using procedures from servicesDetails:',
          proceduresAmount
        );
      } else if (service && service.serviceInfo && service.serviceInfo.procedures) {
        proceduresAmount = service.serviceInfo.procedures;
        console.log(
          '[AttentionDefaultBuilder] Using procedures from service.serviceInfo:',
          proceduresAmount
        );
      } else if (service && service.serviceInfo && service.serviceInfo.proceduresList) {
        // Use first value from proceduresList as fallback
        const proceduresList = service.serviceInfo.proceduresList
          .trim()
          .split(',')
          .map(p => parseInt(p.trim(), 10))
          .filter(p => !isNaN(p) && p > 0);
        if (proceduresList.length > 0) {
          proceduresAmount = proceduresList[0];
          console.log(
            '[AttentionDefaultBuilder] Using first value from proceduresList:',
            proceduresAmount
          );
        }
      }

      console.log('[AttentionDefaultBuilder] Final proceduresAmount:', proceduresAmount);

      if (proceduresAmount > 1) {
        if (attentionCreated.clientId) {
          const packs = await this.packageService.getPackageByCommerceIdAndClientServices(
            attentionCreated.commerceId,
            attentionCreated.clientId,
            attentionCreated.servicesId[0]
          );
          if (packs && packs.length > 0) {
            // Associate attention to existing active package with sessions remaining
            const activePackage = packs.find(pkg => {
              const isActive = [
                PackageStatus.ACTIVE,
                PackageStatus.CONFIRMED,
                PackageStatus.REQUESTED,
              ].includes(pkg.status);
              const hasPendingSessions = (pkg.proceduresLeft || 0) > 0;
              return isActive && hasPendingSessions;
            });
            if (activePackage) {
              attention.packageId = activePackage.id;
              await this.attentionRepository.update(attention);
              // Add attention to package
              await this.packageService.addProcedureToPackage(
                'ett',
                activePackage.id,
                [],
                [attentionCreated.id]
              );
            } else {
              // No active package found, create new one
              const packageName = service.tag.toLocaleUpperCase();
              const packCreated = await this.packageService.createPackage(
                'ett',
                attentionCreated.commerceId,
                attentionCreated.clientId,
                undefined,
                attentionCreated.id,
                proceduresAmount,
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
          } else {
            // No packages exist, create new one
            const packageName = service.tag.toLocaleUpperCase();
            const packCreated = await this.packageService.createPackage(
              'ett',
              attentionCreated.commerceId,
              attentionCreated.clientId,
              undefined,
              attentionCreated.id,
              proceduresAmount,
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

    // Note: userName/userLastName should be set in attention.service.ts after creation
    // before publishing the event to ensure they're included in Firebase

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
