import { Collection } from 'fireorm';

import {
  ConsultationReason,
  CurrentIllness,
  Diagnostic,
  FunctionalExam,
  MedicalOrder,
  PatientAnamnese,
  PhysicalExam,
  Control,
  PatientDocument,
} from './patient-history.entity';

/**
 * ConsultationHistory - Represents a single consultation/visit
 * This allows efficient querying by attentionId and better scalability
 */
@Collection('consultation-history')
export class ConsultationHistory {
  id: string;
  patientHistoryId: string; // Link to main PatientHistory
  commerceId: string;
  clientId: string;
  attentionId: string; // The attention/consultation ID
  bookingId?: string; // Link to original booking (if from booking)
  controlId?: string; // If this consultation is from a control/comeback
  originalAttentionId?: string; // If this is a comeback, link to original attention

  // All consultation-specific data
  consultationReason: ConsultationReason[];
  currentIllness: CurrentIllness[];
  patientAnamnese: PatientAnamnese[];
  functionalExam: FunctionalExam[];
  physicalExam: PhysicalExam[];
  diagnostic: Diagnostic[];
  medicalOrder: MedicalOrder[];
  control: Control[];
  patientDocument: PatientDocument[];

  // Linked entities (IDs only, actual data fetched separately)
  prescriptionIds: string[];
  examOrderIds: string[];
  referenceIds: string[];

  // Metadata
  date: Date; // Consultation date
  createdBy: string;
  createdAt: Date;
  modifiedBy?: string;
  modifiedAt?: Date;
  active: boolean;
  available: boolean;
}
