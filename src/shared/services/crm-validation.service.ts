import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

/**
 * Serviço de validação de CRM (Conselho Regional de Medicina)
 * Valida CRM e estado conforme regulamentação brasileira
 */
@Injectable()
export class CrmValidationService {
  private readonly logger = new Logger(CrmValidationService.name);
  private readonly cache = new Map<string, { valid: boolean; cachedAt: Date }>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

  /**
   * Estados brasileiros e seus conselhos regionais
   */
  private readonly crmStates = {
    'AC': 'Acre',
    'AL': 'Alagoas',
    'AP': 'Amapá',
    'AM': 'Amazonas',
    'BA': 'Bahia',
    'CE': 'Ceará',
    'DF': 'Distrito Federal',
    'ES': 'Espírito Santo',
    'GO': 'Goiás',
    'MA': 'Maranhão',
    'MT': 'Mato Grosso',
    'MS': 'Mato Grosso do Sul',
    'MG': 'Minas Gerais',
    'PA': 'Pará',
    'PB': 'Paraíba',
    'PR': 'Paraná',
    'PE': 'Pernambuco',
    'PI': 'Piauí',
    'RJ': 'Rio de Janeiro',
    'RN': 'Rio Grande do Norte',
    'RS': 'Rio Grande do Sul',
    'RO': 'Rondônia',
    'RR': 'Roraima',
    'SC': 'Santa Catarina',
    'SP': 'São Paulo',
    'SE': 'Sergipe',
    'TO': 'Tocantins',
  };

  /**
   * Validar formato de CRM
   */
  validateCrmFormat(crm: string, state: string): {
    valid: boolean;
    errors?: string[];
  } {
    const errors: string[] = [];

    // Validar formato: números apenas
    if (!/^\d+$/.test(crm)) {
      errors.push('CRM deve conter apenas números');
    }

    // Validar estado
    if (!state || !this.crmStates[state.toUpperCase()]) {
      errors.push(`Estado inválido: ${state}`);
    }

    // Validar tamanho (geralmente 4-6 dígitos)
    if (crm.length < 4 || crm.length > 6) {
      errors.push('CRM deve ter entre 4 e 6 dígitos');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validar CRM consultando conselho regional (se API disponível)
   * Por enquanto, valida apenas formato. Integração com APIs dos conselhos pode ser adicionada
   */
  async validateCrm(
    crm: string,
    state: string,
    doctorName?: string
  ): Promise<{
    valid: boolean;
    verified: boolean; // true se foi verificado com conselho, false se apenas formato
    errors?: string[];
    crmInfo?: {
      crm: string;
      state: string;
      doctorName?: string;
      verifiedAt?: Date;
    };
  }> {
    try {
      // Validar formato primeiro
      const formatValidation = this.validateCrmFormat(crm, state);
      if (!formatValidation.valid) {
        return {
          valid: false,
          verified: false,
          errors: formatValidation.errors,
        };
      }

      // Verificar cache
      const cacheKey = `${crm}-${state.toUpperCase()}`;
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.cachedAt.getTime()) < this.CACHE_TTL) {
        return {
          valid: cached.valid,
          verified: false,
          crmInfo: {
            crm,
            state: state.toUpperCase(),
            doctorName,
          },
        };
      }

      // Por enquanto, apenas validação de formato
      // TODO: Integrar com APIs dos conselhos regionais quando disponíveis
      // Exemplo de integração futura:
      // const verified = await this.verifyWithRegionalCouncil(crm, state);

      const result = {
        valid: true,
        verified: false, // Não verificado com conselho ainda
        crmInfo: {
          crm,
          state: state.toUpperCase(),
          doctorName,
        },
      };

      // Cachear resultado
      this.cache.set(cacheKey, {
        valid: result.valid,
        cachedAt: new Date(),
      });

      return result;
    } catch (error) {
      this.logger.error(`Error validating CRM: ${error.message}`, error.stack);
      return {
        valid: false,
        verified: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Verificar CRM com conselho regional (implementação futura)
   * Cada conselho regional pode ter sua própria API
   */
  private async verifyWithRegionalCouncil(
    crm: string,
    state: string
  ): Promise<boolean> {
    // TODO: Implementar integração com APIs dos conselhos regionais
    // Exemplos:
    // - CRM-SP: https://www.cremesp.org.br
    // - CRM-RJ: https://www.cremerj.org.br
    // - CRM-MG: https://www.crmmg.org.br
    // etc.

    // Por enquanto, retorna false (não verificado)
    return false;
  }

  /**
   * Obter informações do conselho regional por estado
   */
  getRegionalCouncilInfo(state: string): {
    state: string;
    stateName: string;
    councilName?: string;
    website?: string;
  } {
    const stateUpper = state.toUpperCase();
    const stateName = this.crmStates[stateUpper];

    // Informações dos conselhos (pode ser expandido)
    const councilInfo: { [key: string]: { name: string; website: string } } = {
      'SP': { name: 'CREMESP', website: 'https://www.cremesp.org.br' },
      'RJ': { name: 'CREMERJ', website: 'https://www.cremerj.org.br' },
      'MG': { name: 'CRMMG', website: 'https://www.crmmg.org.br' },
      // Adicionar mais conforme necessário
    };

    const council = councilInfo[stateUpper];

    return {
      state: stateUpper,
      stateName: stateName || state,
      councilName: council?.name,
      website: council?.website,
    };
  }

  /**
   * Limpar cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}













