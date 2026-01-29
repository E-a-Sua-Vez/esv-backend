import { Injectable, HttpException, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { CommerceService } from '../../commerce/commerce.service';
import { PackageService } from '../../package/package.service';
import { PackageStatus } from '../../package/model/package-status.enum';
import { PackageType } from '../../package/model/package-type.enum';
import { QueueService } from '../../queue/queue.service';
import { ServiceService } from '../../service/service.service';
import { CreateTelemedicineSessionDto } from '../../telemedicine/dto/create-telemedicine-session.dto';
import { TelemedicineSessionType } from '../../telemedicine/model/telemedicine-session.entity';
import { TelemedicineService } from '../../telemedicine/telemedicine.service';
import AttentionCreated from '../events/AttentionCreated';
import { AttentionChannel } from '../model/attention-channel.enum';
import { AttentionStatus } from '../model/attention-status.enum';
import { AttentionType } from '../model/attention-type.enum';
import { Attention, Block } from '../model/attention.entity';

@Injectable()
export class AttentionTelemedicineBuilder {
  constructor(
    @InjectRepository(Attention)
    private attentionRepository = getRepository(Attention),
    private queueService: QueueService,
    private telemedicineService: TelemedicineService,
    private commerceService: CommerceService,
    private packageService: PackageService,
    private serviceService: ServiceService
  ) {}

  async create(
    queue: any,
    collaboratorId?: string,
    channel: string = AttentionChannel.TELEMEDICINE,
    userId?: string,
    date?: Date,
    servicesId?: string[],
    servicesDetails?: object[],
    clientId?: string,
    telemedicineConfig?: {
      type: TelemedicineSessionType;
      scheduledAt: Date;
      recordingEnabled?: boolean;
      notes?: string;
    }
  ): Promise<Attention> {
    if (!telemedicineConfig) {
      throw new HttpException('Telemedicine configuration is required', HttpStatus.BAD_REQUEST);
    }

    // Crear la atención
    const currentNumber = queue.currentNumber;
    const attention = new Attention();
    attention.status = AttentionStatus.PENDING;
    attention.type = AttentionType.TELEMEDICINE;
    attention.createdAt = date || new Date();
    attention.queueId = queue.id;
    attention.commerceId = queue.commerceId;
    attention.number = currentNumber + 1;
    attention.channel = channel;

    if (queue.professionalId !== undefined) {
      attention.collaboratorId = queue.professionalId; // Attention usa collaboratorId para referirse al profesional que registra
    } else if (queue.collaboratorId !== undefined) {
      // Compatibilidad temporal: si aún no migrado, usar collaboratorId del queue
      attention.collaboratorId = queue.collaboratorId;
    }
    if (collaboratorId !== undefined) {
      attention.collaboratorId = collaboratorId;
    }
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

    // Actualizar número de cola
    queue.currentNumber = attention.number;
    if (
      queue.currentNumber === 1 ||
      !queue.currentAttentionNumber ||
      queue.currentAttentionNumber === 0
    ) {
      queue.currentAttentionId = attentionCreated.id;
      queue.currentAttentionNumber = attention.number;
    }
    queue.currentAttentionNumber = queue.currentAttentionNumber + 1;
    await this.queueService.updateQueue('', queue);

    // Obtener configuración del comercio para grabación
    let recordingEnabled = false;
    try {
      const commerce = await this.commerceService.getCommerce(queue.commerceId);
      recordingEnabled = commerce.telemedicineRecordingEnabled || false;
    } catch (error) {
      // Si no se puede obtener el comercio, usar false por defecto
      recordingEnabled = false;
    }

    // Crear sesión de telemedicina
    const sessionDto: CreateTelemedicineSessionDto = {
      commerceId: queue.commerceId,
      clientId: clientId || attentionCreated.clientId,
      doctorId: collaboratorId || queue.professionalId || queue.collaboratorId,
      attentionId: attentionCreated.id,
      type: telemedicineConfig.type,
      scheduledAt: telemedicineConfig.scheduledAt,
      recordingEnabled: recordingEnabled, // Usar configuración del comercio
      notes: telemedicineConfig.notes,
    };

    const telemedicineSession = await this.telemedicineService.createSession(
      userId || '',
      sessionDto
    );

    // Vincular sesión con atención y guardar configuración
    // Usar recordingEnabled del commerce (no del telemedicineConfig pasado) para consistencia
    attentionCreated.telemedicineSessionId = telemedicineSession.id;
    attentionCreated.telemedicineConfig = {
      type: telemedicineConfig.type,
      scheduledAt: telemedicineConfig.scheduledAt,
      recordingEnabled: recordingEnabled, // Usar configuración del commerce (ya obtenida arriba)
      notes: telemedicineConfig.notes,
    };
    await this.attentionRepository.update(attentionCreated);

    // Crear package si el servicio tiene procedures > 1
    if (attentionCreated.servicesId && attentionCreated.servicesId.length === 1) {
      const service = await this.serviceService.getServiceById(attentionCreated.servicesId[0]);

      // Determine procedures amount: from servicesDetails first, then service.serviceInfo.procedures, then service.serviceInfo.proceduresList
      let proceduresAmount = 0;
      console.log('[AttentionTelemedicineBuilder] Determining procedures amount:', {
        servicesDetails: servicesDetails,
        servicesDetailsLength: servicesDetails?.length,
        firstServiceDetails: servicesDetails?.[0],
        proceduresInDetails: servicesDetails?.[0]?.['procedures'],
        serviceProcedures: service?.serviceInfo?.procedures,
        serviceProceduresList: service?.serviceInfo?.proceduresList
      });

      if (servicesDetails && servicesDetails.length > 0 && servicesDetails[0]['procedures']) {
        proceduresAmount = parseInt(servicesDetails[0]['procedures'], 10) || servicesDetails[0]['procedures'];
        console.log('[AttentionTelemedicineBuilder] Using procedures from servicesDetails:', proceduresAmount);
      } else if (service && service.serviceInfo && service.serviceInfo.procedures) {
        proceduresAmount = service.serviceInfo.procedures;
        console.log('[AttentionTelemedicineBuilder] Using procedures from service.serviceInfo:', proceduresAmount);
      } else if (service && service.serviceInfo && service.serviceInfo.proceduresList) {
        // Use first value from proceduresList as fallback
        const proceduresList = service.serviceInfo.proceduresList.trim().split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p) && p > 0);
        if (proceduresList.length > 0) {
          proceduresAmount = proceduresList[0];
          console.log('[AttentionTelemedicineBuilder] Using first value from proceduresList:', proceduresAmount);
        }
      }

      console.log('[AttentionTelemedicineBuilder] Final proceduresAmount:', proceduresAmount);

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
              const isActive = [PackageStatus.ACTIVE, PackageStatus.CONFIRMED, PackageStatus.REQUESTED].includes(pkg.status);
              const hasPendingSessions = (pkg.proceduresLeft || 0) > 0;
              return isActive && hasPendingSessions;
            });
            if (activePackage) {
              attentionCreated.packageId = activePackage.id;
              await this.attentionRepository.update(attentionCreated);
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
              attentionCreated.packageId = packCreated.id;
              await this.attentionRepository.update(attentionCreated);
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
            attentionCreated.packageId = packCreated.id;
            await this.attentionRepository.update(attentionCreated);
          }
        }
      }
    }

    // Note: Professional auto-assignment is handled in AttentionService after creation

    // Publicar evento
    const attentionCreatedEvent = new AttentionCreated(
      attentionCreated.createdAt || new Date(),
      attentionCreated
    );
    publish(attentionCreatedEvent);

    return attentionCreated;
  }
}
