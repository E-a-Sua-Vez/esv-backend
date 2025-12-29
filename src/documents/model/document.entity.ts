import { Collection } from 'fireorm';

import { DocumentType, DocumentCategory, DocumentUrgency, DocumentStatus } from './document.enum';

export class DocumentOption {
  name: string;
  type: string;
}

export class DocumentMetadata {
  clientName: string;
  clientLastName: string;
  clientIdNumber: string;
  clientEmail: string;
  optionSelected: object;
  // Enhanced metadata for ecosystem integration
  doctorName?: string;
  doctorId?: string;
  specialty?: string;
  studyDate?: Date;
  expirationDate?: Date;
  relatedDiagnosis?: string[];
  clinicalNotes?: string;
}

export class DocumentRelationship {
  relatedDocumentId: string;
  relationshipType: 'version' | 'series' | 'reference' | 'comparison';
  description?: string;
  createdAt: Date;
  createdBy: string;
}

export class DocumentAccess {
  userId: string;
  userType: 'collaborator' | 'client' | 'admin';
  accessType: 'view' | 'download' | 'annotate' | 'share';
  accessedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

@Collection('document')
export class Document {
  id: string;
  name: string;
  originalName?: string; // Original filename when uploaded
  option: string;
  type: DocumentType;
  category: DocumentCategory; // New: Medical category
  commerceId: string;
  clientId: string;

  // Ecosystem Integration Fields
  attentionId?: string; // Link to specific attention/consultation
  patientHistoryId?: string; // Link to patient history record
  collaboratorId?: string; // Doctor/collaborator who uploaded

  // Document Properties
  active: boolean;
  available: boolean;
  location: string;
  format: string;
  fileSize?: number;
  thumbnailLocation?: string; // For preview thumbnails

  // Enhanced Classification
  urgency: DocumentUrgency;
  status: DocumentStatus;
  tags: string[]; // Custom tags for organization
  isConfidential: boolean;
  requiresReview: boolean;
  reviewedBy?: string;
  reviewedAt?: Date;

  // Relationships
  relationships?: DocumentRelationship[];
  parentDocumentId?: string; // For document versions
  version?: number;

  // Comprehensive Date Tracking
  createdAt: Date; // Document record creation date
  uploadedAt?: Date; // When file was uploaded to S3
  generatedAt?: Date; // When document was auto-generated (prescriptions, orders, etc.)
  lastAccessedAt?: Date; // Last time document was viewed
  lastDownloadedAt?: Date; // Last time document was downloaded
  lastModifiedAt?: Date; // Last time document metadata was modified
  archivedAt?: Date; // When document was archived
  deletedAt?: Date; // Soft delete timestamp

  // Audit Trail
  accessLog?: DocumentAccess[];
  createdBy: string;
  modifiedBy?: string;
  uploadedBy?: string; // User who uploaded the file
  generatedBy?: string; // System/user who generated the document
  lastAccessedBy?: string; // Last user who accessed
  lastDownloadedBy?: string; // Last user who downloaded
  documentMetadata: DocumentMetadata;
}
