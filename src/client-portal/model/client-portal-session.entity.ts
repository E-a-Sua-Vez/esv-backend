import { Collection } from 'fireorm';

/**
 * Entidade de sessão do portal do cliente
 * Representa uma sessão autenticada do cliente no portal
 */
@Collection('client-portal-session')
export class ClientPortalSession {
  id: string;

  // Identificação
  clientId: string;
  commerceId: string;

  // Token de sessão (UUID)
  sessionToken: string;

  // Código de acesso (4-8 caracteres)
  accessCode: string; // Código enviado (plaintext, não armazenado após validação)
  accessCodeHash: string; // Hash do código para validação
  accessCodeSent: boolean; // Se o código foi enviado
  accessCodeValidated: boolean; // Se o código foi validado
  accessCodeSentAt?: Date; // Quando o código foi enviado
  accessCodeValidatedAt?: Date; // Quando o código foi validado
  accessCodeExpiresAt: Date; // Expiração do código (15 minutos)
  accessCodeValidationAttempts: number; // Tentativas de validação
  accessCodeLockedUntil?: Date; // Bloqueio por muitas tentativas

  // Validade da sessão
  expiresAt: Date; // Expiração da sessão (7 dias)
  lastAccessAt: Date; // Último acesso

  // Tracking
  ipAddress?: string; // IP do primeiro acesso
  userAgent?: string; // User agent do navegador
  validatedVia?: 'EMAIL' | 'WHATSAPP' | 'SMS' | 'EMAIL+WHATSAPP' | 'EMAIL+SMS'; // Como foi validado

  // Metadata
  active: boolean;
  available: boolean;
  createdAt: Date;
  updatedAt?: Date;
}





