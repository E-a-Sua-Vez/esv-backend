import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import ClinicalAlertAcknowledged from './events/ClinicalAlertAcknowledged';
import ClinicalAlertCreated from './events/ClinicalAlertCreated';
import ClinicalAlertResolved from './events/ClinicalAlertResolved';
import { ClinicalAlert, AlertType, AlertSeverity } from './model/clinical-alert.entity';

@Injectable()
export class ClinicalAlertsService {
  constructor(
    @InjectRepository(ClinicalAlert)
    private alertRepository = getRepository(ClinicalAlert)
  ) {}

  /**
   * Crear una alerta clínica
   */
  async createAlert(
    user: string,
    alertData: {
      commerceId: string;
      clientId: string;
      attentionId?: string;
      patientHistoryId?: string;
      type: AlertType;
      severity: AlertSeverity;
      title: string;
      message: string;
      details?: string;
      context?: any;
    }
  ): Promise<ClinicalAlert> {
    const alert = new ClinicalAlert();
    alert.commerceId = alertData.commerceId;
    alert.clientId = alertData.clientId;
    alert.attentionId = alertData.attentionId;
    alert.patientHistoryId = alertData.patientHistoryId;
    alert.type = alertData.type;
    alert.severity = alertData.severity;
    alert.title = alertData.title;
    alert.message = alertData.message;
    alert.details = alertData.details;
    alert.context = alertData.context;
    alert.acknowledged = false;
    alert.active = true;
    alert.available = true;
    alert.createdAt = new Date();
    alert.createdBy = user;

    const created = await this.alertRepository.create(alert);

    // Publicar evento
    const alertCreatedEvent = new ClinicalAlertCreated(new Date(), created, { user });
    publish(alertCreatedEvent);

    return created;
  }

  /**
   * Obtener alertas de un paciente
   */
  async getAlertsByClient(
    commerceId: string,
    clientId: string,
    activeOnly = true
  ): Promise<ClinicalAlert[]> {
    let query = this.alertRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .whereEqualTo('available', true);

    if (activeOnly) {
      query = query.whereEqualTo('active', true);
    }

    return await query.orderByDescending('createdAt').find();
  }

  /**
   * Obtener alertas por atención
   */
  async getAlertsByAttention(commerceId: string, attentionId: string): Promise<ClinicalAlert[]> {
    return await this.alertRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('attentionId', attentionId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .orderByDescending('createdAt')
      .find();
  }

  /**
   * Reconocer una alerta
   */
  async acknowledgeAlert(user: string, alertId: string): Promise<ClinicalAlert> {
    const alert = await this.alertRepository.findById(alertId);
    if (!alert) {
      throw new HttpException('Alert not found', HttpStatus.NOT_FOUND);
    }

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = user;

    const updated = await this.alertRepository.update(alert);

    // Publicar evento
    const alertAcknowledgedEvent = new ClinicalAlertAcknowledged(new Date(), updated, { user });
    publish(alertAcknowledgedEvent);

    return updated;
  }

  /**
   * Resolver una alerta
   */
  async resolveAlert(user: string, alertId: string): Promise<ClinicalAlert> {
    const alert = await this.alertRepository.findById(alertId);
    if (!alert) {
      throw new HttpException('Alert not found', HttpStatus.NOT_FOUND);
    }

    alert.active = false;
    alert.resolvedAt = new Date();
    alert.resolvedBy = user;

    const updated = await this.alertRepository.update(alert);

    // Publicar evento
    const alertResolvedEvent = new ClinicalAlertResolved(new Date(), updated, { user });
    publish(alertResolvedEvent);

    return updated;
  }

  /**
   * Validar alergias al prescribir
   */
  async checkAllergies(clientId: string, medicationIds: string[]): Promise<ClinicalAlert[]> {
    // TODO: Obtener alergias del paciente desde patient history
    // Por ahora retornamos estructura vacía
    return [];
  }

  /**
   * Validar interacciones medicamentosas
   */
  async checkDrugInteractions(clientId: string, medicationIds: string[]): Promise<ClinicalAlert[]> {
    // TODO: Implementar lógica de validación de interacciones
    // Por ahora retornamos estructura vacía
    return [];
  }

  /**
   * Validar contraindicaciones
   */
  async checkContraindications(
    clientId: string,
    medicationIds: string[],
    diagnosisCodes: string[]
  ): Promise<ClinicalAlert[]> {
    // TODO: Implementar lógica de validación de contraindicaciones
    return [];
  }
}
