import { Collection } from 'fireorm';

import { ExamOrderStatus, ExamPriority, ExamType } from './exam-order-status.enum';

export class ExamItem {
  examId: string;
  examName: string;
  examCode?: string;
  preparation?: string;
  instructions?: string;
}

export class ExamResult {
  id: string;
  examId: string;
  examName: string;
  examCode?: string; // LOINC code
  performedAt?: Date;
  resultDate?: Date;
  values?: Array<{
    parameter: string;
    value: string | number;
    unit: string;
    referenceRange?: string;
    status?: 'normal' | 'high' | 'low' | 'critical';
    loincCode?: string;
  }>;
  observations?: string;
  interpretation?: string; // Interpretación del médico
  interpretedBy?: string;
  status: 'preliminary' | 'final' | 'corrected';
  documents?: string[]; // URLs de documentos adjuntos
  attachments?: string[]; // URLs de documentos adjuntos (alias)
  normalRange?: string; // Rango normal general del examen
  criticalValues?: string[]; // Valores críticos detectados
  uploadedBy?: string; // Usuario que cargó el resultado
  uploadedAt?: Date; // Fecha de carga
  previousResultId?: string; // ID del resultado anterior para comparación
  comparisonNotes?: string; // Notas de comparación con resultado anterior
}

export class ExamOrderExtension {
  id: string;
  originalOrderId: string;
  extendedAt: Date;
  extendedBy: string;
  reason: string;
  additionalExams?: ExamItem[];
  status: 'pending' | 'approved' | 'rejected';
}

@Collection('medical-exam-order')
export class MedicalExamOrder {
  id: string;
  commerceId: string;
  clientId: string;
  attentionId: string;
  patientHistoryId?: string;

  // Información del médico
  doctorId: string;
  doctorName: string;

  // Exámenes solicitados
  exams: ExamItem[];

  // Información de la orden
  type: ExamType;
  priority: ExamPriority;
  status: ExamOrderStatus;
  clinicalJustification?: string;

  // Fechas
  requestedAt: Date;
  scheduledDate?: Date;
  completedAt?: Date;

  // Resultados
  results?: ExamResult[];

  // Extensiones
  extensions?: ExamOrderExtension[];

  // Laboratorio/Proveedor
  laboratoryId?: string;
  laboratoryName?: string;

  // HL7 Integration
  hl7OrderNumber?: string; // Order number used in HL7 messages
  hl7PatientId?: string; // Patient ID used in HL7 messages

  // PDF
  pdfUrl?: string; // URL del PDF generado

  // Metadata
  active: boolean;
  available: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}
