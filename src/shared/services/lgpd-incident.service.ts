import { Injectable, Logger, HttpException, HttpStatus, Inject, Optional } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';

import {
  LgpdIncident,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
} from '../model/lgpd-incident.entity';
import { AuditLogService } from './audit-log.service';
import LgpdIncidentReported from '../events/LgpdIncidentReported';
import { LgpdNotificationService } from './lgpd-notification.service';
import { ClientService } from '../../client/client.service';

/**
 * Serviço de gestão de incidentes LGPD
 * Conformidade: LGPD (Lei 13.709/2018) - Artigo 48
 */
@Injectable()
export class LgpdIncidentService {
  private readonly logger = new Logger(LgpdIncidentService.name);

  constructor(
    @InjectRepository(LgpdIncident)
    private incidentRepository = getRepository(LgpdIncident),
    @Optional() @Inject(AuditLogService) private auditLogService?: AuditLogService,
    @Optional() @Inject(LgpdNotificationService) private lgpdNotificationService?: LgpdNotificationService,
    @Optional() @Inject(ClientService) private clientService?: ClientService
  ) {}

  /**
   * Criar novo incidente
   */
  async createIncident(
    user: string,
    incident: Partial<LgpdIncident>
  ): Promise<LgpdIncident> {
    try {
      const newIncident = new LgpdIncident();
      Object.assign(newIncident, incident);
      newIncident.reportedBy = user;
      newIncident.reportedAt = new Date();
      newIncident.status = IncidentStatus.REPORTED;
      newIncident.notifiedToAnpd = false;
      newIncident.notifiedToDataSubjects = false;
      newIncident.active = true;
      newIncident.available = true;
      newIncident.createdAt = new Date();
      newIncident.createdBy = user;

      if (!newIncident.detectedAt) {
        newIncident.detectedAt = new Date();
      }

      const created = await this.incidentRepository.create(newIncident);

      // Publicar evento
      const event = new LgpdIncidentReported(new Date(), {
        incidentId: created.id,
        commerceId: created.commerceId,
        incidentType: created.incidentType,
        severity: created.severity,
        title: created.title,
      }, { user });
      publish(event);

      // Registrar auditoria
      if (this.auditLogService) {
        await this.auditLogService.logAction(
          user,
          'CREATE',
          'lgpd_incident',
          created.id,
          {
            entityName: `Incidente LGPD - ${created.title}`,
            result: 'SUCCESS',
            complianceFlags: {
              lgpdConsent: true,
            },
            metadata: {
              incidentType: created.incidentType,
              severity: created.severity,
              commerceId: created.commerceId,
            },
          }
        );
      }

      // Verificar se precisa notificar ANPD (severidade alta ou crítica)
      if (
        created.severity === IncidentSeverity.HIGH ||
        created.severity === IncidentSeverity.CRITICAL
      ) {
        this.logger.warn(
          `Incidente de alta severidade detectado: ${created.id}. Verificar necessidade de notificação à ANPD.`
        );

        // Preparar notificación ANPD
        if (this.lgpdNotificationService) {
          const anpdNotification = await this.lgpdNotificationService.prepareAnpdNotification(
            created.id,
            created.commerceId,
            created.incidentType,
            created.severity,
            created.affectedRecordsCount || created.affectedClients?.length || 0,
            created.description || ''
          );
          this.logger.warn(`Notificación ANPD preparada. Portal: ${anpdNotification.anpdPortalUrl}`);
        }

        // Notificar a todos los clientes afectados
        if (this.lgpdNotificationService && created.affectedClients && created.affectedClients.length > 0) {
          const actionsText = created.actionsTaken && created.actionsTaken.length > 0
            ? created.actionsTaken.map(a => a.action)
            : [];

          for (const clientId of created.affectedClients) {
            try {
              await this.lgpdNotificationService.notifySecurityIncident(
                clientId,
                created.commerceId,
                created.incidentType,
                created.severity || 'MEDIUM',
                created.description || '',
                actionsText.join(', ')
              );
            } catch (error) {
              this.logger.error(`Error notifying client ${clientId}: ${error.message}`);
            }
          }
        }
      }

      return created;
    } catch (error) {
      this.logger.error(`Error creating incident: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Atualizar incidente
   */
  async updateIncident(
    user: string,
    id: string,
    updates: Partial<LgpdIncident>
  ): Promise<LgpdIncident> {
    try {
      const incident = await this.incidentRepository.findById(id);
      if (!incident) {
        throw new HttpException('Incidente não encontrado', HttpStatus.NOT_FOUND);
      }

      const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

      // Atualizar campos
      if (updates.status !== undefined && updates.status !== incident.status) {
        changes.push({
          field: 'status',
          oldValue: incident.status,
          newValue: updates.status,
        });
        incident.status = updates.status;

        // Atualizar datas conforme status
        if (updates.status === IncidentStatus.CONTAINED && !incident.containedAt) {
          incident.containedAt = new Date();
        }
        if (updates.status === IncidentStatus.RESOLVED && !incident.resolvedAt) {
          incident.resolvedAt = new Date();
        }
        if (updates.status === IncidentStatus.CLOSED && !incident.closedAt) {
          incident.closedAt = new Date();
        }
      }

      if (updates.severity !== undefined) {
        changes.push({
          field: 'severity',
          oldValue: incident.severity,
          newValue: updates.severity,
        });
        incident.severity = updates.severity;
      }

      if (updates.title !== undefined) {
        changes.push({
          field: 'title',
          oldValue: incident.title,
          newValue: updates.title,
        });
        incident.title = updates.title;
      }

      if (updates.description !== undefined) {
        incident.description = updates.description;
      }

      if (updates.notifiedToAnpd !== undefined) {
        changes.push({
          field: 'notifiedToAnpd',
          oldValue: incident.notifiedToAnpd,
          newValue: updates.notifiedToAnpd,
        });
        incident.notifiedToAnpd = updates.notifiedToAnpd;
        if (updates.notifiedToAnpd && !incident.anpdNotificationDate) {
          incident.anpdNotificationDate = new Date();
        }
      }

      if (updates.notifiedToDataSubjects !== undefined) {
        changes.push({
          field: 'notifiedToDataSubjects',
          oldValue: incident.notifiedToDataSubjects,
          newValue: updates.notifiedToDataSubjects,
        });
        incident.notifiedToDataSubjects = updates.notifiedToDataSubjects;
        if (
          updates.notifiedToDataSubjects &&
          !incident.dataSubjectsNotificationDate
        ) {
          incident.dataSubjectsNotificationDate = new Date();
        }
      }

      if (updates.actionsTaken) {
        incident.actionsTaken = updates.actionsTaken;
      }

      if (updates.preventiveMeasures) {
        incident.preventiveMeasures = updates.preventiveMeasures;
      }

      incident.updatedAt = new Date();
      incident.updatedBy = user;

      const updated = await this.incidentRepository.update(incident);

      // Registrar auditoria
      if (this.auditLogService && changes.length > 0) {
        await this.auditLogService.logAction(
          user,
          'UPDATE',
          'lgpd_incident',
          incident.id,
          {
            entityName: `Incidente LGPD - ${incident.title}`,
            result: 'SUCCESS',
            changes,
            complianceFlags: {
              lgpdConsent: true,
            },
          }
        );
      }

      return updated;
    } catch (error) {
      this.logger.error(`Error updating incident: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Erro ao atualizar incidente: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obter incidente por ID
   */
  async getIncidentById(id: string): Promise<LgpdIncident> {
    const incident = await this.incidentRepository.findById(id);
    if (!incident) {
      throw new HttpException('Incidente não encontrado', HttpStatus.NOT_FOUND);
    }
    return incident;
  }

  /**
   * Listar incidentes com filtros
   */
  async listIncidents(
    filters?: {
      commerceId?: string;
      status?: IncidentStatus;
      severity?: IncidentSeverity;
      incidentType?: IncidentType;
      startDate?: Date;
      endDate?: Date;
      reportedBy?: string;
    },
    limit: number = 100
  ): Promise<LgpdIncident[]> {
    try {
      let query = this.incidentRepository.whereEqualTo('active', true);

      if (filters?.commerceId) {
        query = query.whereEqualTo('commerceId', filters.commerceId);
      }
      if (filters?.status) {
        query = query.whereEqualTo('status', filters.status);
      }
      if (filters?.severity) {
        query = query.whereEqualTo('severity', filters.severity);
      }
      if (filters?.incidentType) {
        query = query.whereEqualTo('incidentType', filters.incidentType);
      }
      if (filters?.reportedBy) {
        query = query.whereEqualTo('reportedBy', filters.reportedBy);
      }
      if (filters?.startDate) {
        query = query.whereGreaterOrEqualThan('reportedAt', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.whereLessOrEqualThan('reportedAt', filters.endDate);
      }

      return await query.orderByDescending('reportedAt').limit(limit).find();
    } catch (error) {
      this.logger.error(`Error listing incidents: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Adicionar ação ao incidente
   */
  async addAction(
    user: string,
    incidentId: string,
    action: string,
    description: string
  ): Promise<LgpdIncident> {
    const incident = await this.getIncidentById(incidentId);

    if (!incident.actionsTaken) {
      incident.actionsTaken = [];
    }

    incident.actionsTaken.push({
      timestamp: new Date(),
      action,
      performedBy: user,
      description,
    });

    return this.updateIncident(user, incidentId, {
      actionsTaken: incident.actionsTaken,
    });
  }

  /**
   * Adicionar medida preventiva
   */
  async addPreventiveMeasure(
    user: string,
    incidentId: string,
    measure: string,
    description: string
  ): Promise<LgpdIncident> {
    const incident = await this.getIncidentById(incidentId);

    if (!incident.preventiveMeasures) {
      incident.preventiveMeasures = [];
    }

    incident.preventiveMeasures.push({
      measure,
      description,
      implementedAt: new Date(),
      implementedBy: user,
    });

    return this.updateIncident(user, incidentId, {
      preventiveMeasures: incident.preventiveMeasures,
    });
  }

  /**
   * Marcar como notificado à ANPD
   */
  async markAsNotifiedToAnpd(
    user: string,
    incidentId: string,
    reference?: string
  ): Promise<LgpdIncident> {
    return this.updateIncident(user, incidentId, {
      notifiedToAnpd: true,
      anpdNotificationReference: reference,
    });
  }

  /**
   * Marcar como notificado aos titulares
   */
  async markAsNotifiedToDataSubjects(
    user: string,
    incidentId: string,
    method?: 'EMAIL' | 'PHONE' | 'POSTAL' | 'PUBLIC_NOTICE' | 'OTHER'
  ): Promise<LgpdIncident> {
    return this.updateIncident(user, incidentId, {
      notifiedToDataSubjects: true,
      dataSubjectsNotificationMethod: method,
    });
  }
}

