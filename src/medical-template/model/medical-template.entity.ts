import { Collection } from 'fireorm';

export enum TemplateType {
  DIAGNOSTIC = 'diagnostic',
  ANAMNESIS = 'anamnesis',
  EVOLUTION = 'evolution',
  PRESCRIPTION = 'prescription',
  EXAM_ORDER = 'exam_order',
  REFERENCE = 'reference',
  GENERAL = 'general',
}

export enum TemplateScope {
  PERSONAL = 'personal', // Solo para el médico que lo creó
  COMMERCE = 'commerce', // Para todos los médicos del comercio
  GLOBAL = 'global', // Para todos los comercios (solo admin)
}

export class TemplateVariable {
  name: string; // Nombre de la variable (ej: "patientName")
  label: string; // Etiqueta para mostrar (ej: "Nombre del Paciente")
  type: 'text' | 'date' | 'number' | 'select'; // Tipo de variable
  defaultValue?: string; // Valor por defecto
  options?: string[]; // Opciones para tipo 'select'
  required: boolean; // Si es obligatorio
}

@Collection('medical-template')
export class MedicalTemplate {
  id: string;
  commerceId: string;
  doctorId: string; // ID del médico que creó el template
  doctorName?: string; // Nombre del médico (para búsqueda)

  // Información del template
  name: string; // Nombre del template
  description?: string; // Descripción del template
  type: TemplateType; // Tipo de template
  category?: string; // Categoría (ej: "Cardiología", "Pediatría")

  // Contenido
  content: string; // Contenido del template con variables {{variableName}}
  variables: TemplateVariable[]; // Variables disponibles en el template

  // Alcance
  scope: TemplateScope; // Alcance del template

  // Tags para búsqueda
  tags: string[]; // Tags para facilitar búsqueda

  // Metadata
  usageCount: number; // Contador de uso
  lastUsedAt?: Date; // Última vez que se usó
  isFavorite: boolean; // Si es favorito del médico

  // Estado
  active: boolean;
  available: boolean;

  // Timestamps
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}
