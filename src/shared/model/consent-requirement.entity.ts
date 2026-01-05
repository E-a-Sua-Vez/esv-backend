import { Collection } from 'fireorm';
import { ConsentType } from './lgpd-consent.entity';

/**
 * Timing para solicitar consentimientos
 */
export enum ConsentRequestTiming {
  BOOKING = 'BOOKING', // Durante la reserva
  PRE_ATTENTION = 'PRE_ATTENTION', // Antes de la atención (pre-formulario)
  CHECK_IN = 'CHECK_IN', // Durante el check-in
  FIRST_ATTENTION = 'FIRST_ATTENTION', // Primera atención
  ON_REGISTRATION = 'ON_REGISTRATION', // No cadastro inicial
  ON_LOGIN = 'ON_LOGIN', // No login (para consentimentos expirados)
  PERIODIC_RENEWAL = 'PERIODIC_RENEWAL', // Renovação periódica (ex: anual)
  BEFORE_SERVICE = 'BEFORE_SERVICE', // Antes de serviço específico
  AFTER_ATTENTION = 'AFTER_ATTENTION', // Após atenção (para pesquisas)
}

/**
 * Métodos de solicitud de consentimiento
 */
export enum ConsentRequestMethod {
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  WEB_FORM = 'WEB_FORM',
  PRESENTIAL = 'PRESENTIAL',
  SMS = 'SMS', // SMS
  PUSH_NOTIFICATION = 'PUSH_NOTIFICATION', // Notificação Push
  IN_APP = 'IN_APP', // Dentro do App
  QR_CODE = 'QR_CODE', // Código QR
}

/**
 * Entidad de requisito de consentimiento
 * Define qué consentimientos son necesarios para cada comercio
 */
@Collection('consent-requirement')
export class ConsentRequirement {
  id: string;

  // Identificación del comercio
  commerceId: string;

  // Tipo de consentimiento requerido
  consentType: ConsentType;

  // Configuración
  required: boolean; // ¿Es obligatorio?
  blockingForAttention: boolean; // ¿Bloquea la atención si falta?

  // Estrategia de solicitud
  requestStrategy: {
    timing: ConsentRequestTiming; // Cuándo solicitar
    methods: ConsentRequestMethod[]; // Cómo solicitar
    reminderIntervalHours: number; // Intervalo entre recordatorios (horas)
    maxReminders: number; // Máximo de recordatorios
    expiresInDays?: number; // Días hasta expirar (opcional)
    autoRenew?: boolean; // Renovación automática
    renewalReminderDays?: number; // Días antes para recordar renovación
  };

  // Plantillas para comunicación
  templates: {
    email?: string; // Plantilla de email
    whatsapp?: string; // Plantilla de WhatsApp
    formIntroText?: string; // Texto introductorio para formulario web (resumo curto)
    fullTerms?: string; // Termos legais completos
    dataDescription?: string; // Descrição detalhada dos dados processados
    legalBasis?: string; // Base legal (LGPD Art. 7º)
    retentionPeriod?: string; // Prazo de retenção dos dados
    privacyPolicyLink?: string; // Link para política de privacidade
    revocationInstructions?: string; // Instruções de como revogar o consentimento
  };

  // Metadata
  active: boolean;
  available: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
}





