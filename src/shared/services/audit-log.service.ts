import { Injectable, Logger } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { AuditLog } from '../model/audit-log.entity';

/**
 * Serviço de auditoria complementar ao sistema de eventos CQRS
 *
 * O sistema de eventos CQRS já registra eventos de domínio (CREATE, UPDATE, etc.)
 * Este serviço complementa com:
 * - Informações específicas de conformidade legal (CFM, LGPD)
 * - Ações não cobertas por eventos (ACCESS, PRINT, EXPORT, LOGIN, LOGOUT)
 * - Metadados de conformidade (IP, user agent, compliance flags)
 * - Rastreabilidade detalhada para auditoria legal
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository = getRepository(AuditLog)
  ) {}

  /**
   * Registrar uma ação de auditoria
   *
   * NOTA: Este serviço complementa o sistema de eventos CQRS.
   * Eventos de domínio (CREATE, UPDATE, DELETE) são registrados via sistema de eventos.
   * Este serviço adiciona informações de conformidade legal específicas.
   */
  async logAction(
    userId: string,
    action: AuditLog['action'],
    entityType: string,
    entityId: string,
    options?: {
      userName?: string;
      userEmail?: string;
      entityName?: string;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      changes?: { field: string; oldValue?: any; newValue?: any }[];
      result?: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
      errorMessage?: string;
      metadata?: { [key: string]: any };
      complianceFlags?: {
        lgpdConsent?: boolean;
        signedDocument?: boolean;
        dataExport?: boolean;
      };
      businessId?: string;
      commerceId?: string;
    }
  ): Promise<AuditLog> {
    try {
      const auditLog = new AuditLog();
      auditLog.userId = userId;
      auditLog.action = action;
      auditLog.entityType = entityType;
      auditLog.entityId = entityId;
      auditLog.timestamp = new Date();
      auditLog.result = options?.result || 'SUCCESS';

      if (options?.userName) auditLog.userName = options.userName;
      if (options?.userEmail) auditLog.userEmail = options.userEmail;
      if (options?.entityName) auditLog.entityName = options.entityName;
      if (options?.ipAddress) auditLog.ipAddress = options.ipAddress;
      if (options?.userAgent) auditLog.userAgent = options.userAgent;
      if (options?.sessionId) auditLog.sessionId = options.sessionId;
      if (options?.changes) auditLog.changes = options.changes;
      if (options?.errorMessage) auditLog.errorMessage = options.errorMessage;
      if (options?.metadata) auditLog.metadata = options.metadata;
      if (options?.complianceFlags) auditLog.complianceFlags = options.complianceFlags;
      if (options?.businessId) auditLog.businessId = options.businessId;
      if (options?.commerceId) auditLog.commerceId = options.commerceId;

      auditLog.createdAt = new Date();

      return await this.auditLogRepository.create(auditLog);
    } catch (error) {
      this.logger.error(`Error creating audit log: ${error.message}`, error.stack);
      // Não lançar erro para não quebrar o fluxo principal
      throw error;
    }
  }

  /**
   * Buscar logs por entidade
   */
  async getLogsByEntity(
    entityType: string,
    entityId: string,
    limit: number = 100
  ): Promise<AuditLog[]> {
    try {
      return await this.auditLogRepository
        .whereEqualTo('entityType', entityType)
        .whereEqualTo('entityId', entityId)
        .orderByDescending('timestamp')
        .limit(limit)
        .find();
    } catch (error) {
      this.logger.error(`Error getting logs by entity: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Buscar logs por usuário
   */
  async getLogsByUser(
    userId: string,
    limit: number = 100
  ): Promise<AuditLog[]> {
    try {
      return await this.auditLogRepository
        .whereEqualTo('userId', userId)
        .orderByDescending('timestamp')
        .limit(limit)
        .find();
    } catch (error) {
      this.logger.error(`Error getting logs by user: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Buscar logs por período
   */
  async getLogsByPeriod(
    startDate: Date,
    endDate: Date,
    limit: number = 1000
  ): Promise<AuditLog[]> {
    try {
      return await this.auditLogRepository
        .whereGreaterOrEqualThan('timestamp', startDate)
        .whereLessOrEqualThan('timestamp', endDate)
        .orderByDescending('timestamp')
        .limit(limit)
        .find();
    } catch (error) {
      this.logger.error(`Error getting logs by period: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Buscar logs por ação
   */
  async getLogsByAction(
    action: AuditLog['action'],
    limit: number = 100
  ): Promise<AuditLog[]> {
    try {
      return await this.auditLogRepository
        .whereEqualTo('action', action)
        .orderByDescending('timestamp')
        .limit(limit)
        .find();
    } catch (error) {
      this.logger.error(`Error getting logs by action: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Gerar relatório de auditoria
   */
  async generateAuditReport(
    filters?: {
      userId?: string;
      entityType?: string;
      entityId?: string;
      action?: AuditLog['action'];
      startDate?: Date;
      endDate?: Date;
      businessId?: string;
      commerceId?: string;
    }
  ): Promise<{
    total: number;
    byAction: { [key: string]: number };
    byUser: { [key: string]: number };
    byEntityType: { [key: string]: number };
    logs: AuditLog[];
  }> {
    try {
      let query: any = this.auditLogRepository;

      if (filters?.businessId) {
        query = query.whereEqualTo('businessId', filters.businessId);
      }
      if (filters?.commerceId) {
        query = query.whereEqualTo('commerceId', filters.commerceId);
      }
      if (filters?.userId) {
        query = query.whereEqualTo('userId', filters.userId);
      }
      if (filters?.entityType) {
        query = query.whereEqualTo('entityType', filters.entityType);
      }
      if (filters?.entityId) {
        query = query.whereEqualTo('entityId', filters.entityId);
      }
      if (filters?.action) {
        query = query.whereEqualTo('action', filters.action);
      }
      if (filters?.startDate) {
        query = query.whereGreaterOrEqualThan('timestamp', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.whereLessOrEqualThan('timestamp', filters.endDate);
      }

      const logs = await query.orderByDescending('timestamp').limit(1000).find();

      const byAction: { [key: string]: number } = {};
      const byUser: { [key: string]: number } = {};
      const byEntityType: { [key: string]: number } = {};

      logs.forEach(log => {
        byAction[log.action] = (byAction[log.action] || 0) + 1;
        byUser[log.userId] = (byUser[log.userId] || 0) + 1;
        byEntityType[log.entityType] = (byEntityType[log.entityType] || 0) + 1;
      });

      return {
        total: logs.length,
        byAction,
        byUser,
        byEntityType,
        logs,
      };
    } catch (error) {
      this.logger.error(`Error generating audit report: ${error.message}`, error.stack);
      throw error;
    }
  }
}

