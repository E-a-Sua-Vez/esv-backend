import {
  Injectable,
  Logger,
  forwardRef,
  Inject,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from 'nestjs-fireorm';
import { getRepository } from 'fireorm';

import { DocumentsService } from '../../documents/documents.service';
import { PatientHistoryService } from '../../patient-history/patient-history.service';
import { ClientService } from '../../client/client.service';
import { CommerceService } from '../../commerce/commerce.service';
import { Document, DocumentMetadata } from '../../documents/model/document.entity';
import { DocumentCategory, DocumentUrgency } from '../../documents/model/document.enum';
import { PatientDocument } from '../../patient-history/model/patient-history.entity';
import { NotificationService } from '../../notification/notification.service';
import { NotificationType } from '../../notification/model/notification-type.enum';

@Injectable()
export class GeneratedDocumentService {
  private readonly logger = new Logger(GeneratedDocumentService.name);

  constructor(
    private documentsService: DocumentsService,
    @Inject(forwardRef(() => PatientHistoryService))
    private patientHistoryService: PatientHistoryService,
    private clientService: ClientService,
    private commerceService: CommerceService,
    private notificationService: NotificationService
  ) {}

  /**
   * Guardar un PDF generado como documento en el historial del paciente
   */
  async saveGeneratedDocumentAsPatientDocument(
    user: string,
    commerceId: string,
    clientId: string,
    attentionId: string,
    documentType: 'prescription' | 'exam_order' | 'reference',
    pdfUrl: string,
    pdfKey: string, // S3 key
    documentName: string,
    metadata: {
      prescriptionId?: string;
      examOrderId?: string;
      referenceId?: string;
      doctorName?: string;
      doctorId?: string;
      diagnosis?: string;
      [key: string]: any;
    }
  ): Promise<{ document: Document; patientDocument: PatientDocument }> {
    try {
      // Obtener información del cliente para metadata
      const client = await this.clientService.getClientById(clientId);

      // Crear metadata del documento
      const documentMetadata: DocumentMetadata = {
        clientName: client?.name || '',
        clientLastName: client?.lastName || '',
        clientIdNumber: client?.idNumber || '',
        clientEmail: client?.email || '',
        optionSelected: {},
        doctorName: metadata.doctorName,
        doctorId: metadata.doctorId,
        relatedDiagnosis: metadata.diagnosis ? [metadata.diagnosis] : [],
      };

      // Determinar categoría según tipo
      let category: DocumentCategory;
      let option: string;

      switch (documentType) {
        case 'prescription':
          category = DocumentCategory.PRESCRIPTION_RECORDS;
          option = 'prescription_pdf';
          break;
        case 'exam_order':
          category = DocumentCategory.LABORATORY_RESULTS;
          option = 'exam_order_pdf';
          break;
        case 'reference':
          category = DocumentCategory.REFERRAL_LETTERS;
          option = 'reference_pdf';
          break;
        default:
          category = DocumentCategory.OTHER;
          option = 'generated_pdf';
      }

      // Crear documento
      const document = await this.documentsService.createClientDocument(
        user,
        documentName,
        commerceId,
        clientId,
        option,
        'application/pdf',
        documentMetadata,
        attentionId,
        undefined, // patientHistoryId se actualizará después
        metadata.doctorId || user,
        category,
        DocumentUrgency.NORMAL,
        [documentType, 'generated', 'pdf']
      );

      // Actualizar documento con location (S3 key)
      document.location = pdfKey;
      document.generatedAt = new Date();
      document.generatedBy = user;
      await this.documentsService.update(user, document);

      // Obtener o crear patient history
      let patientHistory = await this.patientHistoryService.getPatientHistorysByClientId(
        commerceId,
        clientId
      );

      // Si no existe, crear uno básico
      if (!patientHistory) {
        patientHistory = await this.patientHistoryService.createPatientHistory(
          user,
          commerceId,
          clientId,
          'STANDARD' as any,
          undefined,
          [],
          [],
          undefined,
          [],
          [],
          [],
          [],
          [],
          undefined,
          attentionId,
          []
        );
      }

      // Crear PatientDocument
      const patientDocument: PatientDocument = {
        documents: document,
        comment: `Documento generado automáticamente: ${documentType}`,
        details: undefined, // Puede ser un PatientHistoryItem si es necesario
        attentionId,
        createdAt: new Date(),
        createdBy: user,
      };

      // Actualizar patient history
      // updatePatientHistoryConfigurations maneja automáticamente la adición del documento al array
      // Verifica si ya existe un documento para esta atención en el mismo día y lo actualiza o agrega uno nuevo
      await this.patientHistoryService.updatePatientHistoryConfigurations(
        user,
        patientHistory.id,
        patientHistory.personalData,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        patientHistory.active,
        patientHistory.available,
        attentionId,
        patientDocument
      );

      // Actualizar documento con patientHistoryId
      document.patientHistoryId = patientHistory.id;
      await this.documentsService.update(user, document);

      this.logger.log(`Document saved as patient document: ${document.id} for patient ${clientId}`);

      return { document, patientDocument };
    } catch (error) {
      this.logger.error(`Error saving generated document: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Enviar documento por email
   */
  async sendDocumentByEmail(
    user: string,
    commerceId: string,
    clientId: string,
    attentionId: string,
    documentId: string,
    recipientEmail: string,
    subject?: string,
    message?: string
  ): Promise<void> {
    try {
      const document = await this.documentsService.getDocumentById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Obtener PDF desde S3
      const pdfBuffer = await this.getDocumentFromS3(document.location, commerceId);

      // Convertir a base64 para attachment
      const pdfBase64 = pdfBuffer.toString('base64');

      // Preparar email
      const emailSubject = subject || `Documento médico - ${document.name}`;
      const emailMessage = message || `Adjunto encontrará el documento médico solicitado.`;

      // Obtener información del comercio para el remitente
      const commerce = await this.commerceService.getCommerceById(commerceId);
      const fromEmail = commerce?.email || process.env.EMAIL_FROM || 'noreply@ett.com';

      // Enviar email con attachment usando rawEmailNotify
      await this.notificationService.rawEmailNotify({
        from: fromEmail,
        to: [recipientEmail],
        subject: emailSubject,
        text: emailMessage,
        html: `<p>${emailMessage}</p><p>Adjunto encontrará el documento: <strong>${document.name}</strong></p>`,
        attachments: [
          {
            content: pdfBase64,
            filename: `${document.name}.pdf`,
            encoding: 'base64',
          },
        ],
      });

      this.logger.log(`Document ${documentId} sent by email to ${recipientEmail}`);
    } catch (error) {
      this.logger.error(`Error sending document by email: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Obtener documento desde S3
   */
  private async getDocumentFromS3(s3Key: string, commerceId: string): Promise<Buffer> {
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      region: process.env.AWS_DEFAULT_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME || process.env.AWS_S3_COMMERCE_BUCKET,
      Key: s3Key,
    };

    try {
      const result = await s3.getObject(params).promise();
      return result.Body as Buffer;
    } catch (error) {
      const code = error?.code;

      if (code === 'NoSuchKey') {
        this.logger.warn(
          `S3 object not found for key=${s3Key}, commerceId=${commerceId}: ${error.message}`
        );
        throw new NotFoundException('Documento no encontrado en almacenamiento');
      }

      this.logger.error(
        `Error retrieving S3 object for key=${s3Key}, commerceId=${commerceId}: ${error.message}`,
        error.stack
      );
      throw new InternalServerErrorException('Error recuperando documento desde almacenamiento');
    }
  }

  /**
   * Obtener URL firmada del documento desde S3
   */
  private async getSignedDocumentUrl(s3Key: string, commerceId: string): Promise<string> {
    // Esta función debería obtener la URL firmada desde S3
    // Por ahora retornamos la key, pero debería generar una URL firmada
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      region: process.env.AWS_DEFAULT_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: s3Key,
      Expires: 3600, // 1 hora
    };

    return s3.getSignedUrl('getObject', params);
  }
}

