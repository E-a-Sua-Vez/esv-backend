/**
 * Mensajes LGPD para notificaciones
 * Soporta múltiples idiomas: pt (português), es (español), en (inglês)
 */

export interface LgpdMessages {
  pt: {
    consentGranted: (clientName: string, purpose: string, commerceName: string) => string;
    consentRevoked: (clientName: string, purpose: string, commerceName: string, reason?: string) => string;
    dataPortabilityReady: (clientName: string, downloadUrl: string) => string;
    securityIncident: (clientName: string, commerceName: string, incidentType: string, severity: string, actionsTaken?: string) => string;
    actionsTaken: string;
    defaultCommerceName: string;
  };
  es: {
    consentGranted: (clientName: string, purpose: string, commerceName: string) => string;
    consentRevoked: (clientName: string, purpose: string, commerceName: string, reason?: string) => string;
    dataPortabilityReady: (clientName: string, downloadUrl: string) => string;
    securityIncident: (clientName: string, commerceName: string, incidentType: string, severity: string, actionsTaken?: string) => string;
    actionsTaken: string;
    defaultCommerceName: string;
  };
  en: {
    consentGranted: (clientName: string, purpose: string, commerceName: string) => string;
    consentRevoked: (clientName: string, purpose: string, commerceName: string, reason?: string) => string;
    dataPortabilityReady: (clientName: string, downloadUrl: string) => string;
    securityIncident: (clientName: string, commerceName: string, incidentType: string, severity: string, actionsTaken?: string) => string;
    actionsTaken: string;
    defaultCommerceName: string;
  };
}

export const LGPD_MESSAGES: LgpdMessages = {
  pt: {
    consentGranted: (clientName: string, purpose: string, commerceName: string) =>
      `Olá ${clientName}, seu consentimento para ${purpose} foi registrado com sucesso em ${commerceName}.`,
    consentRevoked: (clientName: string, purpose: string, commerceName: string, reason?: string) => {
      const reasonText = reason ? ` Motivo: ${reason}.` : '';
      return `Olá ${clientName}, seu consentimento para ${purpose} foi revogado em ${commerceName}.${reasonText}`;
    },
    dataPortabilityReady: (clientName: string, downloadUrl: string) =>
      `Olá ${clientName}, seu arquivo de portabilidade de dados está pronto. Acesse: ${downloadUrl}`,
    securityIncident: (clientName: string, commerceName: string, incidentType: string, severity: string, actionsTaken?: string) => {
      const actionsText = actionsTaken ? `\n\nAções tomadas: ${actionsTaken}` : '';
      return `Olá ${clientName}, informamos sobre um incidente de segurança em ${commerceName}. Tipo: ${incidentType}. Severidade: ${severity}.${actionsText}`;
    },
    actionsTaken: 'Ações tomadas',
    defaultCommerceName: 'Clínica',
  },
  es: {
    consentGranted: (clientName: string, purpose: string, commerceName: string) =>
      `Hola ${clientName}, tu consentimiento para ${purpose} ha sido registrado con éxito en ${commerceName}.`,
    consentRevoked: (clientName: string, purpose: string, commerceName: string, reason?: string) => {
      const reasonText = reason ? ` Motivo: ${reason}.` : '';
      return `Hola ${clientName}, tu consentimiento para ${purpose} ha sido revocado en ${commerceName}.${reasonText}`;
    },
    dataPortabilityReady: (clientName: string, downloadUrl: string) =>
      `Hola ${clientName}, tu archivo de portabilidad de datos está listo. Accede: ${downloadUrl}`,
    securityIncident: (clientName: string, commerceName: string, incidentType: string, severity: string, actionsTaken?: string) => {
      const actionsText = actionsTaken ? `\n\nAcciones tomadas: ${actionsTaken}` : '';
      return `Hola ${clientName}, te informamos sobre un incidente de seguridad en ${commerceName}. Tipo: ${incidentType}. Severidad: ${severity}.${actionsText}`;
    },
    actionsTaken: 'Acciones tomadas',
    defaultCommerceName: 'Clínica',
  },
  en: {
    consentGranted: (clientName: string, purpose: string, commerceName: string) =>
      `Hello ${clientName}, your consent for ${purpose} has been successfully registered at ${commerceName}.`,
    consentRevoked: (clientName: string, purpose: string, commerceName: string, reason?: string) => {
      const reasonText = reason ? ` Reason: ${reason}.` : '';
      return `Hello ${clientName}, your consent for ${purpose} has been revoked at ${commerceName}.${reasonText}`;
    },
    dataPortabilityReady: (clientName: string, downloadUrl: string) =>
      `Hello ${clientName}, your data portability file is ready. Access: ${downloadUrl}`,
    securityIncident: (clientName: string, commerceName: string, incidentType: string, severity: string, actionsTaken?: string) => {
      const actionsText = actionsTaken ? `\n\nActions taken: ${actionsTaken}` : '';
      return `Hello ${clientName}, we inform you about a security incident at ${commerceName}. Type: ${incidentType}. Severity: ${severity}.${actionsText}`;
    },
    actionsTaken: 'Actions taken',
    defaultCommerceName: 'Clinic',
  },
};

/**
 * Mensajes para logs y notificaciones internas (no se envían al cliente)
 */
export const LGPD_INTERNAL_MESSAGES = {
  pt: {
    anpdNotificationPrepared: (anpdPortalUrl: string) =>
      `Incidente crítico detectado. Notificar ANPD manualmente: ${anpdPortalUrl}`,
    anpdPortalUrl: 'https://www.gov.br/anpd/pt-br/canais_atendimento/notificacao-de-incidentes',
  },
  es: {
    anpdNotificationPrepared: (anpdPortalUrl: string) =>
      `Incidente crítico detectado. Notificar ANPD manualmente: ${anpdPortalUrl}`,
    anpdPortalUrl: 'https://www.gov.br/anpd/pt-br/canais_atendimento/notificacao-de-incidentes',
  },
  en: {
    anpdNotificationPrepared: (anpdPortalUrl: string) =>
      `Critical incident detected. Notify ANPD manually: ${anpdPortalUrl}`,
    anpdPortalUrl: 'https://www.gov.br/anpd/pt-br/canais_atendimento/notificacao-de-incidentes',
  },
};

/**
 * Obtiene los mensajes según el idioma
 * @param language - Idioma ('pt', 'es', 'en'). Por defecto 'pt'
 */
export function getLgpdMessages(language: string = 'pt'): LgpdMessages['pt'] {
  const lang = language.toLowerCase().substring(0, 2);
  switch (lang) {
    case 'es':
      return LGPD_MESSAGES.es;
    case 'en':
      return LGPD_MESSAGES.en;
    case 'pt':
    default:
      return LGPD_MESSAGES.pt;
  }
}

/**
 * Obtiene los mensajes internos según el idioma
 * @param language - Idioma ('pt', 'es', 'en'). Por defecto 'pt'
 */
export function getLgpdInternalMessages(language: string = 'pt') {
  const lang = language.toLowerCase().substring(0, 2);
  switch (lang) {
    case 'es':
      return LGPD_INTERNAL_MESSAGES.es;
    case 'en':
      return LGPD_INTERNAL_MESSAGES.en;
    case 'pt':
    default:
      return LGPD_INTERNAL_MESSAGES.pt;
  }
}

