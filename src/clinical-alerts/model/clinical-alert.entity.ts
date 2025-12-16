import { Collection } from 'fireorm';

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AlertType {
  ALLERGY = 'allergy',
  DRUG_INTERACTION = 'drug_interaction',
  CONTRAINDICATION = 'contraindication',
  ABNORMAL_VALUE = 'abnormal_value',
  MISSING_DATA = 'missing_data',
  DUPLICATE_PRESCRIPTION = 'duplicate_prescription',
  EXAM_RESULT_CRITICAL = 'exam_result_critical',
  EXAM_RESULT_ABNORMAL = 'exam_result_abnormal',
}

@Collection('clinical-alert')
export class ClinicalAlert {
  id: string;
  commerceId: string;
  clientId: string;
  attentionId?: string;
  patientHistoryId?: string;

  // Tipo y severidad
  type: AlertType;
  severity: AlertSeverity;

  // Información de la alerta
  title: string;
  message: string;
  details?: string;

  // Contexto
  context?: {
    medicationId?: string;
    medicationName?: string;
    diagnosisCode?: string;
    diagnosisName?: string;
    examType?: string;
    examValue?: string;
    relatedAlertId?: string;
  };

  // Estado
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;

  // Metadata
  active: boolean;
  available: boolean;
  createdAt: Date;
  createdBy: string;
  resolvedAt?: Date;
  resolvedBy?: string;
}
