import { Collection } from 'fireorm';

/**
 * Entidade de log de auditoria
 * Registra todas as ações realizadas no sistema para conformidade legal (CFM, LGPD)
 */
@Collection('audit-log')
export class AuditLog {
  id: string;

  // Identificação do usuário
  userId: string;
  userName?: string;
  userEmail?: string;

  // Ação realizada
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'SIGN' | 'EXPORT' | 'PRINT' | 'ACCESS' | 'LOGIN' | 'LOGOUT';

  // Entidade afetada
  entityType: string; // 'prescription', 'exam_order', 'reference', 'patient_history', etc.
  entityId: string;
  entityName?: string;

  // Contexto da ação
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;

  // Detalhes da mudança
  changes?: {
    field: string;
    oldValue?: any;
    newValue?: any;
  }[];

  // Resultado
  result: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  errorMessage?: string;

  // Metadados adicionais
  metadata?: {
    [key: string]: any;
  };

  // Informações de conformidade
  complianceFlags?: {
    lgpdConsent?: boolean;
    signedDocument?: boolean;
    dataExport?: boolean;
  };

  // Contexto de negócio (para filtragem)
  businessId?: string;
  commerceId?: string;

  createdAt: Date;
}




