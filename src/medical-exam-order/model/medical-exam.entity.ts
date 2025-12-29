import { Collection } from 'fireorm';

@Collection('medical-exam')
export class MedicalExam {
  id: string;
  commerceId: string; // ✅ Agregado
  name: string;
  code?: string; // Código LOINC
  type: string; // laboratory, imaging, procedure, other
  category?: string;
  description?: string;
  preparation?: string; // Preparación requerida
  estimatedDuration?: number; // Duración estimada en minutos
  cost?: number;
  active: boolean;
  available: boolean;
  createdAt: Date;
  updatedAt: Date;
}
