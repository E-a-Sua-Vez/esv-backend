import { Collection } from 'fireorm';

import { PrescriptionStatus } from './prescription-status.enum';

export class MedicationItem {
  medicationId: string; // ID del medicamento en el catálogo
  medicationName: string; // Nombre del medicamento
  commercialName?: string; // Nombre comercial si aplica
  dosage: string; // Dosis (ej: "500mg")
  frequency: string; // Frecuencia (ej: "cada 8 horas", "2 veces al día")
  duration: number; // Duración en días
  quantity: number; // Cantidad total
  route: string; // Vía de administración
  instructions?: string; // Indicaciones especiales
  refillsAllowed: number; // Número de refuerzos permitidos
  refillsUsed: number; // Número de refuerzos utilizados
}

export class Dispensation {
  id: string;
  date: Date;
  pharmacy?: string; // Nombre de la farmacia
  pharmacist?: string; // Nombre del farmacéutico
  quantity: number; // Cantidad dispensada
  notes?: string;
}

@Collection('prescription')
export class Prescription {
  id: string;
  commerceId: string;
  clientId: string;
  attentionId: string; // ID de la atención asociada
  patientHistoryId?: string; // ID del prontuario asociado

  // Información del médico
  doctorId: string;
  doctorName: string;
  doctorLicense?: string; // Número de licencia médica

  // Medicamentos
  medications: MedicationItem[];

  // Información general
  date: Date;
  validUntil: Date; // Fecha de validez de la receta
  status: PrescriptionStatus;

  // Observaciones
  observations?: string;
  instructions?: string; // Instrucciones generales al paciente

  // Refuerzos
  totalRefillsAllowed: number;
  totalRefillsUsed: number;

  // Dispensaciones
  dispensations: Dispensation[];

  // Metadata
  active: boolean;
  available: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;

  // PDF generado
  pdfUrl?: string; // URL del PDF generado
  qrCode?: string; // Código QR para verificación
}
