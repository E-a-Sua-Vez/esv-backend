import { Collection } from 'fireorm';

/**
 * Tipo de incidente LGPD
 */
export enum IncidentType {
  DATA_BREACH = 'DATA_BREACH', // Violação de dados
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS', // Acesso não autorizado
  DATA_LOSS = 'DATA_LOSS', // Perda de dados
  DATA_ALTERATION = 'DATA_ALTERATION', // Alteração indevida de dados
  DATA_DISCLOSURE = 'DATA_DISCLOSURE', // Divulgação indevida
  SYSTEM_FAILURE = 'SYSTEM_FAILURE', // Falha do sistema
  OTHER = 'OTHER', // Outro
}

/**
 * Severidade do incidente
 */
export enum IncidentSeverity {
  LOW = 'LOW', // Baixa
  MEDIUM = 'MEDIUM', // Média
  HIGH = 'HIGH', // Alta
  CRITICAL = 'CRITICAL', // Crítica
}

/**
 * Status do incidente
 */
export enum IncidentStatus {
  REPORTED = 'REPORTED', // Reportado
  UNDER_INVESTIGATION = 'UNDER_INVESTIGATION', // Em investigação
  CONTAINED = 'CONTAINED', // Contido
  RESOLVED = 'RESOLVED', // Resolvido
  CLOSED = 'CLOSED', // Fechado
}

/**
 * Entidade de incidente LGPD
 * Conformidade: LGPD (Lei 13.709/2018) - Artigo 48
 * Notificação obrigatória à ANPD em caso de incidentes de segurança
 */
@Collection('lgpd-incident')
export class LgpdIncident {
  id: string;

  // Identificação
  commerceId: string;
  reportedBy: string; // ID do usuário que reportou
  reportedByName?: string;
  reportedByEmail?: string;

  // Tipo e severidade
  incidentType: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;

  // Descrição
  title: string;
  description: string;
  affectedData?: string[]; // Tipos de dados afetados
  affectedClients?: string[]; // IDs dos clientes afetados
  affectedRecordsCount?: number; // Número estimado de registros afetados

  // Datas
  detectedAt: Date; // Quando foi detectado
  occurredAt?: Date; // Quando ocorreu (se conhecido)
  reportedAt: Date; // Quando foi reportado
  containedAt?: Date; // Quando foi contido
  resolvedAt?: Date; // Quando foi resolvido
  closedAt?: Date; // Quando foi fechado

  // Notificação ANPD
  notifiedToAnpd: boolean; // Se foi notificado à ANPD
  anpdNotificationDate?: Date; // Data da notificação
  anpdNotificationReference?: string; // Referência da notificação

  // Notificação aos titulares
  notifiedToDataSubjects: boolean; // Se foi notificado aos titulares
  dataSubjectsNotificationDate?: Date; // Data da notificação
  dataSubjectsNotificationMethod?: 'EMAIL' | 'PHONE' | 'POSTAL' | 'PUBLIC_NOTICE' | 'OTHER';

  // Ações tomadas
  actionsTaken?: Array<{
    timestamp: Date;
    action: string;
    performedBy: string;
    description: string;
  }>;

  // Medidas preventivas
  preventiveMeasures?: Array<{
    measure: string;
    description: string;
    implementedAt: Date;
    implementedBy: string;
  }>;

  // Impacto
  impactDescription?: string;
  potentialHarm?: string; // Dano potencial aos titulares

  // Evidências
  evidence?: Array<{
    type: 'LOG' | 'SCREENSHOT' | 'FILE' | 'REPORT' | 'OTHER';
    description: string;
    url?: string;
    fileId?: string;
  }>;

  // Metadados
  ipAddress?: string;
  userAgent?: string;
  tags?: string[];

  // Observações
  notes?: string;
  internalNotes?: string; // Notas internas (não compartilhadas com ANPD)

  // Metadata
  active: boolean;
  available: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
}














