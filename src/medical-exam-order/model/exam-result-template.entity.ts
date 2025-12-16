import { Collection } from 'fireorm';

export class ExamParameter {
  name: string;
  code?: string; // LOINC code
  unit: string;
  dataType: 'numeric' | 'text' | 'boolean' | 'date';
  required: boolean;
  order: number; // Orden de visualización
}

export class NormalRange {
  min?: number;
  max?: number;
  minText?: string; // Para rangos no numéricos
  maxText?: string;
  gender?: 'male' | 'female' | 'both';
  ageMin?: number; // Edad mínima para este rango
  ageMax?: number; // Edad máxima para este rango
  condition?: string; // Condición especial (ej: "pregnancy")
}

export class CriticalValue {
  type: 'high' | 'low';
  value?: number;
  valueText?: string;
  alertLevel: 'warning' | 'critical';
  message?: string;
}

@Collection('exam-result-template')
export class ExamResultTemplate {
  id: string;
  examCode: string; // LOINC code
  examName: string;
  examType?: string; // Tipo de examen (laboratory, imaging, etc.)

  // Parámetros esperados en este examen
  parameters: ExamParameter[];

  // Rangos normales por parámetro
  normalRanges: Record<string, NormalRange>;

  // Valores críticos por parámetro
  criticalValues: Record<string, CriticalValue>;

  // Configuración
  commerceId?: string; // Si es específico de un comercio
  businessId?: string; // Si es específico de un negocio
  active: boolean;
  available: boolean;

  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}
