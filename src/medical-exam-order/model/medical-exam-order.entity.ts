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
  collaboratorId?: string; // ID del colaborador que emite la orden

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
  documentHash?: string; // Hash SHA-256 del documento para verificación de integridad

  // Assinatura digital ICP-Brasil (conformidade CFM)
  signedAt?: Date; // Data da assinatura
  signedBy?: string; // ID do usuário que assinou
  digitalSignature?: string; // Assinatura digital PKCS#7 (Base64)
  certificateInfo?: {
    issuer: string;
    subject: string;
    serialNumber: string;
    validFrom: Date;
    validTo: Date;
  };
  isSigned?: boolean; // Indica se o documento está assinado (bloqueado para edição)

  // Metadata
  active: boolean;
  available: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}
