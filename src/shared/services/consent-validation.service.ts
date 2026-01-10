import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConsentRequirement } from '../model/consent-requirement.entity';
import { LgpdConsent, ConsentStatus, ConsentType } from '../model/lgpd-consent.entity';
import { ConsentRequestMethod, ConsentRequestTiming } from '../model/consent-requirement.entity';

/**
 * Serviço de validação para consentimentos LGPD
 * Implementa regras de negócio e validações de compliance
 */
@Injectable()
export class ConsentValidationService {
  private readonly logger = new Logger(ConsentValidationService.name);

  /**
   * Valida um requisito de consentimento antes de salvar
   */
  validateRequirement(requirement: Partial<ConsentRequirement>): void {
    if (!requirement.commerceId) {
      throw new HttpException('commerceId é obrigatório', HttpStatus.BAD_REQUEST);
    }

    if (!requirement.consentType) {
      throw new HttpException('consentType é obrigatório', HttpStatus.BAD_REQUEST);
    }

    if (!requirement.requestStrategy) {
      throw new HttpException('requestStrategy é obrigatório', HttpStatus.BAD_REQUEST);
    }

    if (!requirement.requestStrategy.timing) {
      throw new HttpException('requestStrategy.timing é obrigatório', HttpStatus.BAD_REQUEST);
    }

    if (!requirement.requestStrategy.methods || requirement.requestStrategy.methods.length === 0) {
      throw new HttpException(
        'requestStrategy.methods deve conter pelo menos um método',
        HttpStatus.BAD_REQUEST
      );
    }

    // Validar métodos válidos
    const validMethods = Object.values(ConsentRequestMethod);
    for (const method of requirement.requestStrategy.methods) {
      if (!validMethods.includes(method)) {
        throw new HttpException(
          `Método inválido: ${method}. Métodos válidos: ${validMethods.join(', ')}`,
          HttpStatus.BAD_REQUEST
        );
      }
    }

    // Validar timing válido
    const validTimings = Object.values(ConsentRequestTiming);
    if (!validTimings.includes(requirement.requestStrategy.timing)) {
      throw new HttpException(
        `Timing inválido: ${requirement.requestStrategy.timing}. Timings válidos: ${validTimings.join(', ')}`,
        HttpStatus.BAD_REQUEST
      );
    }

    // Validar expiresInDays se fornecido
    if (
      requirement.requestStrategy.expiresInDays !== undefined &&
      requirement.requestStrategy.expiresInDays < 1
    ) {
      throw new HttpException(
        'expiresInDays deve ser maior que 0',
        HttpStatus.BAD_REQUEST
      );
    }

    // Validar renewalReminderDays se fornecido
    if (
      requirement.requestStrategy.renewalReminderDays !== undefined &&
      requirement.requestStrategy.renewalReminderDays < 0
    ) {
      throw new HttpException(
        'renewalReminderDays não pode ser negativo',
        HttpStatus.BAD_REQUEST
      );
    }

    // Validar reminderIntervalHours
    if (
      requirement.requestStrategy.reminderIntervalHours !== undefined &&
      requirement.requestStrategy.reminderIntervalHours < 1
    ) {
      throw new HttpException(
        'reminderIntervalHours deve ser maior que 0',
        HttpStatus.BAD_REQUEST
      );
    }

    // Validar maxReminders
    if (
      requirement.requestStrategy.maxReminders !== undefined &&
      requirement.requestStrategy.maxReminders < 0
    ) {
      throw new HttpException(
        'maxReminders não pode ser negativo',
        HttpStatus.BAD_REQUEST
      );
    }

    // Validar templates se fornecidos
    if (requirement.templates) {
      this.validateTemplates(requirement.templates);
    }
  }

  /**
   * Valida templates de consentimento
   */
  private validateTemplates(templates: any): void {
    // Validar que se há template de WhatsApp, deve ter link placeholder
    if (templates.whatsapp && !templates.whatsapp.includes('{link}')) {
      this.logger.warn(
        'Template WhatsApp não contém placeholder {link}. Link pode não ser incluído na mensagem.'
      );
    }

    // Validar que se há template de email, deve ter link placeholder
    if (templates.email && !templates.email.includes('{link}')) {
      this.logger.warn(
        'Template Email não contém placeholder {link}. Link pode não ser incluído na mensagem.'
      );
    }

    // Validar que fullTerms não está vazio se fornecido
    if (templates.fullTerms !== undefined && templates.fullTerms.trim().length === 0) {
      throw new HttpException(
        'fullTerms não pode estar vazio se fornecido',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Valida se um cliente pode realizar uma ação baseado em seus consentimentos
   */
  async validateConsentForAction(
    commerceId: string,
    clientId: string,
    requiredConsentTypes: ConsentType[],
    blockingForAttention: boolean = true
  ): Promise<{
    allowed: boolean;
    missing: ConsentType[];
    expired: ConsentType[];
    reason?: string;
  }> {
    // TODO: Implementar busca de consentimentos do cliente
    // Por enquanto, retornar estrutura básica
    return {
      allowed: true,
      missing: [],
      expired: [],
    };
  }

  /**
   * Valida se um consentimento pode ser concedido
   */
  validateConsentGrant(consent: Partial<LgpdConsent>): void {
    if (!consent.clientId) {
      throw new HttpException('clientId é obrigatório', HttpStatus.BAD_REQUEST);
    }

    if (!consent.commerceId) {
      throw new HttpException('commerceId é obrigatório', HttpStatus.BAD_REQUEST);
    }

    if (!consent.consentType) {
      throw new HttpException('consentType é obrigatório', HttpStatus.BAD_REQUEST);
    }

    if (!consent.purpose) {
      throw new HttpException('purpose é obrigatório', HttpStatus.BAD_REQUEST);
    }

    // Validar consentType válido
    const validTypes = Object.values(ConsentType);
    if (!validTypes.includes(consent.consentType)) {
      throw new HttpException(
        `Tipo de consentimento inválido: ${consent.consentType}. Tipos válidos: ${validTypes.join(', ')}`,
        HttpStatus.BAD_REQUEST
      );
    }

    // Validar status válido
    if (consent.status) {
      const validStatuses = Object.values(ConsentStatus);
      if (!validStatuses.includes(consent.status)) {
        throw new HttpException(
          `Status inválido: ${consent.status}. Status válidos: ${validStatuses.join(', ')}`,
          HttpStatus.BAD_REQUEST
        );
      }
    }

    // Validar consentMethod válido
    const validMethods = ['WEB', 'MOBILE', 'PRESENTIAL', 'EMAIL', 'PHONE', 'OTHER'];
    if (consent.consentMethod && !validMethods.includes(consent.consentMethod)) {
      throw new HttpException(
        `Método de consentimento inválido: ${consent.consentMethod}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Valida se um consentimento pode ser revogado
   */
  validateConsentRevocation(consent: LgpdConsent): void {
    if (consent.status === ConsentStatus.REVOKED) {
      throw new HttpException('Consentimento já foi revogado', HttpStatus.BAD_REQUEST);
    }

    if (consent.status === ConsentStatus.DENIED) {
      throw new HttpException('Consentimento negado não pode ser revogado', HttpStatus.BAD_REQUEST);
    }

    if (consent.status === ConsentStatus.EXPIRED) {
      throw new HttpException('Consentimento expirado não pode ser revogado', HttpStatus.BAD_REQUEST);
    }

    if (consent.status !== ConsentStatus.GRANTED) {
      throw new HttpException(
        `Consentimento com status ${consent.status} não pode ser revogado`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Valida se um consentimento está válido (não expirado, não revogado)
   */
  isConsentValid(consent: LgpdConsent): boolean {
    if (consent.status !== ConsentStatus.GRANTED) {
      return false;
    }

    if (consent.expiresAt) {
      const now = new Date();
      const expiresAt = new Date(consent.expiresAt);
      if (expiresAt < now) {
        return false;
      }
    }

    return true;
  }

  /**
   * Valida regras de negócio para renovação automática
   */
  validateAutoRenewal(requirement: ConsentRequirement, consent: LgpdConsent): {
    canRenew: boolean;
    reason?: string;
  } {
    if (!requirement.requestStrategy?.autoRenew) {
      return {
        canRenew: false,
        reason: 'Renovação automática não está habilitada para este requisito',
      };
    }

    if (consent.status !== ConsentStatus.GRANTED && consent.status !== ConsentStatus.EXPIRED) {
      return {
        canRenew: false,
        reason: `Consentimento com status ${consent.status} não pode ser renovado automaticamente`,
      };
    }

    // Se o consentimento foi revogado manualmente, não renovar automaticamente
    if (consent.revokedAt && consent.revokedBy && consent.revokedBy !== 'system') {
      return {
        canRenew: false,
        reason: 'Consentimento foi revogado manualmente e não pode ser renovado automaticamente',
      };
    }

    return {
      canRenew: true,
    };
  }

  /**
   * Valida se um método de solicitação é válido para um timing específico
   */
  validateMethodForTiming(
    method: ConsentRequestMethod,
    timing: ConsentRequestTiming
  ): {
    valid: boolean;
    reason?: string;
  } {
    // Alguns métodos não fazem sentido para certos timings
    const invalidCombinations: { [key: string]: string[] } = {
      ON_LOGIN: ['PRESENTIAL', 'QR_CODE'], // Não faz sentido presencial ou QR no login
      ON_REGISTRATION: ['PRESENTIAL'], // Registro geralmente é online
      PERIODIC_RENEWAL: ['PRESENTIAL'], // Renovação periódica geralmente é online
    };

    const invalidMethods = invalidCombinations[timing] || [];
    if (invalidMethods.includes(method)) {
      return {
        valid: false,
        reason: `Método ${method} não é apropriado para timing ${timing}`,
      };
    }

    return {
      valid: true,
    };
  }

  /**
   * Valida se um requisito pode ser deletado
   */
  validateRequirementDeletion(requirement: ConsentRequirement): {
    canDelete: boolean;
    reason?: string;
    warnings?: string[];
  } {
    const warnings: string[] = [];

    // Verificar se há consentimentos ativos para este requisito
    // TODO: Implementar busca real de consentimentos
    // Por enquanto, apenas avisar
    warnings.push(
      'Ao deletar este requisito, consentimentos existentes não serão afetados, mas novos não serão solicitados.'
    );

    return {
      canDelete: true,
      warnings,
    };
  }

  /**
   * Valida compliance LGPD básico
   */
  validateLgpdCompliance(requirement: ConsentRequirement): {
    compliant: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Verificar se há base legal definida
    if (!requirement.templates?.legalBasis || requirement.templates.legalBasis.trim().length === 0) {
      issues.push('Base legal (LGPD Art. 7º) não está definida');
    }

    // Verificar se há descrição dos dados processados
    if (
      !requirement.templates?.dataDescription ||
      requirement.templates.dataDescription.trim().length === 0
    ) {
      warnings.push('Descrição detalhada dos dados processados não está definida');
    }

    // Verificar se há prazo de retenção definido
    if (
      !requirement.templates?.retentionPeriod ||
      requirement.templates.retentionPeriod.trim().length === 0
    ) {
      warnings.push('Prazo de retenção dos dados não está definido');
    }

    // Verificar se há instruções de revogação
    if (
      !requirement.templates?.revocationInstructions ||
      requirement.templates.revocationInstructions.trim().length === 0
    ) {
      warnings.push('Instruções de como revogar o consentimento não estão definidas');
    }

    // Verificar se há link para política de privacidade
    if (
      !requirement.templates?.privacyPolicyLink ||
      requirement.templates.privacyPolicyLink.trim().length === 0
    ) {
      warnings.push('Link para política de privacidade não está definido');
    }

    // Verificar se há termos completos
    if (!requirement.templates?.fullTerms || requirement.templates.fullTerms.trim().length === 0) {
      issues.push('Termos legais completos não estão definidos');
    }

    return {
      compliant: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Valida se um consentimento expirou
   */
  isConsentExpired(consent: LgpdConsent): boolean {
    if (!consent.expiresAt) {
      return false; // Sem data de expiração, nunca expira
    }

    const now = new Date();
    const expiresAt = new Date(consent.expiresAt);
    return expiresAt < now;
  }

  /**
   * Valida se um consentimento está próximo de expirar
   */
  isConsentExpiringSoon(consent: LgpdConsent, daysBefore: number = 30): boolean {
    if (!consent.expiresAt) {
      return false;
    }

    const now = new Date();
    const expiresAt = new Date(consent.expiresAt);
    const daysUntilExpiration = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysUntilExpiration > 0 && daysUntilExpiration <= daysBefore;
  }

  /**
   * Valida regras de negócio para bloqueio de atenção
   */
  validateBlockingForAttention(
    requirements: ConsentRequirement[],
    clientConsents: LgpdConsent[]
  ): {
    blocked: boolean;
    missingRequirements: ConsentRequirement[];
    reason?: string;
  } {
    // Filtrar apenas requisitos que bloqueiam atenção
    const blockingRequirements = requirements.filter(req => req.blockingForAttention === true);

    if (blockingRequirements.length === 0) {
      return {
        blocked: false,
        missingRequirements: [],
      };
    }

    // Verificar quais requisitos não têm consentimento válido
    const missingRequirements: ConsentRequirement[] = [];

    for (const requirement of blockingRequirements) {
      const hasValidConsent = clientConsents.some(consent => {
        if (consent.consentType !== requirement.consentType) {
          return false;
        }

        if (!this.isConsentValid(consent)) {
          return false;
        }

        return true;
      });

      if (!hasValidConsent) {
        missingRequirements.push(requirement);
      }
    }

    return {
      blocked: missingRequirements.length > 0,
      missingRequirements,
      reason:
        missingRequirements.length > 0
          ? `Faltam ${missingRequirements.length} consentimento(s) obrigatório(s) para realizar a atenção`
          : undefined,
    };
  }
}





