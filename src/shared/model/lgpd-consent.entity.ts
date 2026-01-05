import { Collection } from 'fireorm';

/**
 * Tipos de consentimento LGPD
 */
export enum ConsentType {
  DATA_PROCESSING = 'DATA_PROCESSING', // Processamento de dados pessoais
  DATA_SHARING = 'DATA_SHARING', // Compartilhamento de dados
  MARKETING = 'MARKETING', // Marketing e comunicações
  RESEARCH = 'RESEARCH', // Pesquisa científica
  THIRD_PARTY = 'THIRD_PARTY', // Compartilhamento com terceiros
  DATA_EXPORT = 'DATA_EXPORT', // Exportação de dados
  TELEMEDICINE = 'TELEMEDICINE', // Telemedicina
  BIOMETRIC = 'BIOMETRIC', // Dados biométricos
  TERMS_ACCEPTANCE = 'TERMS_ACCEPTANCE', // Aceitação de termos e condições
}

/**
 * Status do consentimento
 */
export enum ConsentStatus {
  GRANTED = 'GRANTED', // Concedido
  DENIED = 'DENIED', // Negado
  REVOKED = 'REVOKED', // Revogado
  EXPIRED = 'EXPIRED', // Expirado
  PENDING = 'PENDING', // Pendente
}

/**
 * Entidade de consentimento LGPD
 * Conformidade: LGPD (Lei 13.709/2018)
 */
@Collection('lgpd-consent')
export class LgpdConsent {
  id: string;

  // Identificação do paciente
  clientId: string;
  commerceId: string;

  // Tipo de consentimento
  consentType: ConsentType;
  status: ConsentStatus;

  // Detalhes do consentimento
  purpose: string; // Finalidade do processamento
  description?: string; // Descrição detalhada
  legalBasis?: string; // Base legal (artigo da LGPD)

  // Período de validade
  grantedAt: Date;
  expiresAt?: Date; // Opcional - se não tiver expiração, é indefinido
  revokedAt?: Date;

  // Informações de quem concedeu/revogou
  grantedBy: string; // ID do usuário que concedeu (pode ser o próprio paciente)
  revokedBy?: string; // ID do usuário que revogou

  // Metadados
  ipAddress?: string; // IP de onde foi concedido
  userAgent?: string; // User agent
  consentMethod: 'WEB' | 'MOBILE' | 'PRESENTIAL' | 'EMAIL' | 'PHONE' | 'OTHER'; // Método de consentimento

  // Histórico de alterações
  history?: Array<{
    timestamp: Date;
    action: 'GRANTED' | 'DENIED' | 'REVOKED' | 'UPDATED' | 'EXPIRED';
    performedBy: string;
    reason?: string;
    ipAddress?: string;
  }>;

  // Dados específicos do consentimento
  specificData?: {
    [key: string]: any; // Dados específicos conforme o tipo de consentimento
  };

  // Notas e observações
  notes?: string;

  // Metadata
  active: boolean;
  available: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
}

