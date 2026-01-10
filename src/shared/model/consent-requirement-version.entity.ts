import { Collection } from 'fireorm';
import { ConsentRequirement } from './consent-requirement.entity';

/**
 * Entidade de versão de requisito de consentimento
 * Armazena histórico de alterações nos requisitos
 */
@Collection('consent-requirement-version')
export class ConsentRequirementVersion {
  id: string;

  // Referência ao requisito original
  requirementId: string;
  commerceId: string;

  // Versão
  version: number; // Número sequencial da versão (1, 2, 3, ...)

  // Snapshot completo do requisito na versão
  snapshot: ConsentRequirement;

  // Informações da alteração
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changedBy: string;
  changedAt: Date;

  // Campos alterados (para UPDATE)
  changedFields?: string[]; // Lista de campos que foram alterados

  // Descrição da mudança (opcional)
  changeDescription?: string;

  // Metadata
  active: boolean;
  available: boolean;
  createdAt: Date;
}





