import { Injectable } from '@nestjs/common';

import { DocumentsService } from './documents.service';

/**
 * Document Integration Service
 *
 * This service provides helper methods for other services (prescriptions, medical orders, etc.)
 * to automatically create document records when documents are generated.
 *
 * Usage:
 * - Inject this service into prescription, medical-order, medical-reference services
 * - Call createDocumentForGeneratedContent() when generating PDFs/documents
 */
@Injectable()
export class DocumentIntegrationService {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * Create a document record for auto-generated medical documents
   * (prescriptions, medical orders, references, consultation notes, etc.)
   */
  async createDocumentForGeneratedContent(
    user: string,
    commerceId: string,
    clientId: string,
    documentType: 'PRESCRIPTION' | 'MEDICAL_ORDER' | 'MEDICAL_REFERENCE' | 'CONSULTATION_NOTES' | 'DISCHARGE_SUMMARY',
    documentData: {
      name: string;
      content?: string; // PDF/HTML content if available
      fileUrl?: string; // URL to generated file if stored externally
      attentionId?: string;
      patientHistoryId?: string;
      collaboratorId?: string;
      category?: string;
      urgency?: string;
      tags?: string[];
      metadata?: any;
    }
  ) {
    return this.documentsService.createGeneratedDocument(
      user,
      commerceId,
      clientId,
      documentType,
      documentData
    );
  }

  /**
   * Create document for prescription
   */
  async createPrescriptionDocument(
    user: string,
    commerceId: string,
    clientId: string,
    prescriptionId: string,
    prescriptionData: {
      name: string;
      fileUrl?: string;
      attentionId?: string;
      patientHistoryId?: string;
      collaboratorId?: string;
      tags?: string[];
    }
  ) {
    return this.createDocumentForGeneratedContent(
      user,
      commerceId,
      clientId,
      'PRESCRIPTION',
      {
        name: prescriptionData.name || `Prescripción ${prescriptionId}`,
        fileUrl: prescriptionData.fileUrl,
        attentionId: prescriptionData.attentionId,
        patientHistoryId: prescriptionData.patientHistoryId,
        collaboratorId: prescriptionData.collaboratorId,
        category: 'PRESCRIPTIONS',
        urgency: 'NORMAL',
        tags: ['prescription', ...(prescriptionData.tags || [])],
        metadata: {
          prescriptionId,
          generatedAt: new Date().toISOString()
        }
      }
    );
  }

  /**
   * Create document for medical order
   */
  async createMedicalOrderDocument(
    user: string,
    commerceId: string,
    clientId: string,
    orderId: string,
    orderData: {
      name: string;
      fileUrl?: string;
      attentionId?: string;
      patientHistoryId?: string;
      collaboratorId?: string;
      tags?: string[];
    }
  ) {
    return this.createDocumentForGeneratedContent(
      user,
      commerceId,
      clientId,
      'MEDICAL_ORDER',
      {
        name: orderData.name || `Orden Médica ${orderId}`,
        fileUrl: orderData.fileUrl,
        attentionId: orderData.attentionId,
        patientHistoryId: orderData.patientHistoryId,
        collaboratorId: orderData.collaboratorId,
        category: 'MEDICAL_ORDERS',
        urgency: 'NORMAL',
        tags: ['medical-order', 'order', ...(orderData.tags || [])],
        metadata: {
          orderId,
          generatedAt: new Date().toISOString()
        }
      }
    );
  }

  /**
   * Create document for medical reference
   */
  async createMedicalReferenceDocument(
    user: string,
    commerceId: string,
    clientId: string,
    referenceId: string,
    referenceData: {
      name: string;
      fileUrl?: string;
      attentionId?: string;
      patientHistoryId?: string;
      collaboratorId?: string;
      tags?: string[];
    }
  ) {
    return this.createDocumentForGeneratedContent(
      user,
      commerceId,
      clientId,
      'MEDICAL_REFERENCE',
      {
        name: referenceData.name || `Referencia Médica ${referenceId}`,
        fileUrl: referenceData.fileUrl,
        attentionId: referenceData.attentionId,
        patientHistoryId: referenceData.patientHistoryId,
        collaboratorId: referenceData.collaboratorId,
        category: 'REFERRALS',
        urgency: 'NORMAL',
        tags: ['reference', 'referral', ...(referenceData.tags || [])],
        metadata: {
          referenceId,
          generatedAt: new Date().toISOString()
        }
      }
    );
  }

  /**
   * Create document for consultation notes
   */
  async createConsultationNotesDocument(
    user: string,
    commerceId: string,
    clientId: string,
    attentionId: string,
    notesData: {
      name: string;
      fileUrl?: string;
      patientHistoryId?: string;
      collaboratorId?: string;
      tags?: string[];
    }
  ) {
    return this.createDocumentForGeneratedContent(
      user,
      commerceId,
      clientId,
      'CONSULTATION_NOTES',
      {
        name: notesData.name || `Notas de Consulta - ${attentionId}`,
        fileUrl: notesData.fileUrl,
        attentionId,
        patientHistoryId: notesData.patientHistoryId,
        collaboratorId: notesData.collaboratorId,
        category: 'CONSULTATION_NOTES',
        urgency: 'NORMAL',
        tags: ['consultation', 'notes', ...(notesData.tags || [])],
        metadata: {
          attentionId,
          generatedAt: new Date().toISOString()
        }
      }
    );
  }

  /**
   * Create document for discharge summary
   */
  async createDischargeSummaryDocument(
    user: string,
    commerceId: string,
    clientId: string,
    attentionId: string,
    summaryData: {
      name: string;
      fileUrl?: string;
      patientHistoryId?: string;
      collaboratorId?: string;
      tags?: string[];
    }
  ) {
    return this.createDocumentForGeneratedContent(
      user,
      commerceId,
      clientId,
      'DISCHARGE_SUMMARY',
      {
        name: summaryData.name || `Alta Médica - ${attentionId}`,
        fileUrl: summaryData.fileUrl,
        attentionId,
        patientHistoryId: summaryData.patientHistoryId,
        collaboratorId: summaryData.collaboratorId,
        category: 'DISCHARGE_SUMMARY',
        urgency: 'NORMAL',
        tags: ['discharge', 'summary', 'alta', ...(summaryData.tags || [])],
        metadata: {
          attentionId,
          generatedAt: new Date().toISOString()
        }
      }
    );
  }
}









