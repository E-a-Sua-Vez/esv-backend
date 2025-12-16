import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { CommerceService } from '../../commerce/commerce.service';
import { QueueService } from '../../queue/queue.service';
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
    private commerceService: CommerceService
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

    if (queue.collaboratorId !== undefined) {
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
      doctorId: collaboratorId || queue.collaboratorId,
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

    // Publicar evento
    const attentionCreatedEvent = new AttentionCreated(
      attentionCreated.createdAt || new Date(),
      attentionCreated
    );
    publish(attentionCreatedEvent);

    return attentionCreated;
  }
}
