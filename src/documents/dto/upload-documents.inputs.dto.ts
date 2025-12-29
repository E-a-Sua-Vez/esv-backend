import { DocumentMetadata } from '../model/document.entity';

export class UploadDocumentsInputsDto {
  commerceId: string;
  clientId: string;
  documentMetadata: DocumentMetadata;
  details: object;
  name: string;
  reportType: string;
  format: string;
  file: File;
  // Enhanced fields for ecosystem integration
  attentionId?: string;
  patientHistoryId?: string;
  collaboratorId?: string;
  category?: string;
  urgency?: string;
  tags?: string[];
  clinicalNotes?: string;
  studyDate?: string;
  expirationDate?: string;
  isConfidential?: boolean;
}

export class DocumentSearchDto {
  commerceId: string;
  clientId?: string;
  category?: string;
  urgency?: string;
  status?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  collaboratorId?: string;
  attentionId?: string;
  searchText?: string;
  page?: number;
  limit?: number;
}
