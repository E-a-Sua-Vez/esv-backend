import { Readable } from 'stream';

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import {
  validateFilename,
  generateSafeFilename,
  validateImageContent,
  validatePDFContent,
} from '../shared/utils/security-utils';

import DocumentCreated from './events/DocumentCreated';
import DocumentUpdated from './events/DocumentUpdated';
import DocumentAccessed from './events/DocumentAccessed';
import DocumentDownloaded from './events/DocumentDownloaded';
import { Document, DocumentMetadata, DocumentOption } from './model/document.entity';
import { DocumentType } from './model/document.enum';
import * as documents from './model/documents.json';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentRepository = getRepository(Document)
  ) {
    AWS.config.update({
      apiVersion: '2006-03-01',
      region: process.env.AWS_DEFAULT_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
  }

  private reportType = {
    terms_of_service: 'terms_of_service',
    post_attention: 'post_attention',
    patient_documents: 'patient_documents',
  };

  public getBucketPath(reportType: string): string {
    const folder = this.reportType[reportType];
    return `${process.env.AWS_S3_COMMERCE_BUCKET}/${folder}`;
  }

  private extractUserId(user: any): string {
    if (!user) return '';

    // Debug logging to understand user structure
    console.log('User object received:', typeof user, user);

    // Handle different user object structures - prioritize ID fields
    if (typeof user === 'string') {
      // If it's already a string, return it (but ensure it's not empty)
      return user.trim() || '';
    }

    // Try to extract ID from object
    if (user && typeof user === 'object') {
      // Priority order: id, userId, sub, email
      if (user.id !== undefined && user.id !== null) {
        return String(user.id).trim();
      }
      if (user.userId !== undefined && user.userId !== null) {
        return String(user.userId).trim();
      }
      if (user.sub !== undefined && user.sub !== null) {
        return String(user.sub).trim();
      }
      if (user.email !== undefined && user.email !== null) {
        return String(user.email).trim();
      }

      // If no ID found, log warning and return empty string
      console.warn('User object has no extractable ID field, using empty string:', user);
      return '';
    }

    // Fallback: convert to string
    const result = String(user || '').trim();
    return result;
  }

  private sanitizeMetadata(value: any): string {
    if (value === null || value === undefined) return '';

    // If it's already a string, return it (but ensure it's not empty)
    if (typeof value === 'string') {
      return value.trim() || '';
    }

    // If it's a number or boolean, convert to string
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    // If it's an object or array, try to extract meaningful value
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map(v => String(v)).join(',');
      }

      // For objects, try common ID fields first
      if (value.id) return String(value.id);
      if (value.userId) return String(value.userId);
      if (value.email) return String(value.email);
      if (value.name) return String(value.name);

      // As last resort, return empty string for objects to avoid AWS errors
      console.warn('Complex object passed to metadata, using empty string:', value);
      return '';
    }

    return String(value);
  }

  public getDocumentOptions(): DocumentOption[] {
    const options = documents;
    return options.sort((a, b) => (a.type < b.type ? -1 : 1));
  }

  public getDocumentOptionByName(name: string): any {
    const options = documents;
    return options.find(option => option.name === name);
  }

  public getDocumentsByAttention(attentionId: string): Promise<Document[]> {
    return this.documentRepository
      .whereEqualTo('attentionId', attentionId)
      .whereEqualTo('available', true)
      .orderByDescending('createdAt')
      .find();
  }

  public getDocumentsByPatientHistory(patientHistoryId: string): Promise<Document[]> {
    return this.documentRepository
      .whereEqualTo('patientHistoryId', patientHistoryId)
      .whereEqualTo('available', true)
      .orderByDescending('createdAt')
      .find();
  }

  public async getDocumentsByClientWithFilters(
    commerceId: string,
    clientId: string,
    filters: {
      category?: string;
      urgency?: string;
      status?: string;
      tags?: string[];
      dateFrom?: Date;
      dateTo?: Date;
      collaboratorId?: string;
      attentionId?: string;
    }
  ): Promise<Document[]> {
    let query = this.documentRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .whereEqualTo('available', true);

    if (filters.category) {
      query = query.whereEqualTo('category', filters.category);
    }
    if (filters.urgency) {
      query = query.whereEqualTo('urgency', filters.urgency);
    }
    if (filters.status) {
      query = query.whereEqualTo('status', filters.status);
    }
    if (filters.collaboratorId) {
      query = query.whereEqualTo('collaboratorId', filters.collaboratorId);
    }
    if (filters.attentionId) {
      query = query.whereEqualTo('attentionId', filters.attentionId);
    }
    if (filters.dateFrom) {
      query = query.whereGreaterOrEqualThan('createdAt', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.whereLessOrEqualThan('createdAt', filters.dateTo);
    }

    return query.orderByDescending('createdAt').find();
  }

  public async addDocumentAccess(
    documentId: string,
    userId: string,
    userType: string,
    accessType: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // Use the new tracking method which includes CQRS events
    if (accessType === 'download') {
      await this.trackDocumentDownload(documentId, userId, userType as any, ipAddress, userAgent);
    } else {
      await this.trackDocumentAccess(documentId, userId, userType as any, accessType as any, ipAddress, userAgent);
    }
  }

  public async linkDocumentToAttention(
    documentId: string,
    attentionId: string,
    user: string
  ): Promise<Document> {
    const document = await this.getDocumentById(documentId);
    document.attentionId = attentionId;
    document.modifiedBy = user;
    document.lastModifiedAt = new Date();
    return await this.update(user, document);
  }

  public async updateDocumentTags(
    documentId: string,
    tags: string[],
    user: string
  ): Promise<Document> {
    const document = await this.getDocumentById(documentId);
    document.tags = tags;
    document.modifiedBy = user;
    document.lastModifiedAt = new Date();
    return await this.update(user, document);
  }

  public async getDocumentById(id: string): Promise<Document> {
    return await this.documentRepository.findById(id);
  }

  public async createDocument(
    user: string,
    name: string,
    commerceId: string,
    option: string,
    format: string
  ): Promise<Document> {
    let document = new Document();
    const existingDocument = await this.getDocumentsByOption(commerceId, option);
    if (existingDocument) {
      document = existingDocument;
      document.name = name;
      document.active = true;
      document.format = format;
      document.modifiedBy = user;
      document.lastModifiedAt = new Date();
      return await this.update(user, document);
    } else {
      document.name = name;
      document.commerceId = commerceId;
      document.type = commerceId ? DocumentType.COMMERCE : DocumentType.STANDARD;
      document.active = true;
      document.format = format;
      document.option = option;
      document.createdBy = user;
      document.createdAt = new Date();
      const documentCreated = await this.documentRepository.create(document);
      const documentCreatedEvent = new DocumentCreated(new Date(), documentCreated, { user });
      publish(documentCreatedEvent);
      return documentCreated;
    }
  }

  public async createClientDocument(
    user: string,
    name: string,
    commerceId: string,
    clientId: string,
    option: string,
    format: string,
    documentMetadata: DocumentMetadata,
    attentionId?: string,
    patientHistoryId?: string,
    collaboratorId?: string,
    category?: string,
    urgency?: string,
    tags?: string[]
  ): Promise<Document> {
    const document = new Document();
    document.name = name;
    document.commerceId = commerceId;
    document.clientId = clientId;
    document.type = DocumentType.CLIENT;
    document.format = format;
    document.option = option;
    document.createdBy = user;
    document.documentMetadata = documentMetadata;

    // Enhanced ecosystem integration
    document.attentionId = attentionId;
    document.patientHistoryId = patientHistoryId;
    document.collaboratorId = collaboratorId || user;
    document.category = category as any || 'OTHER';
    document.urgency = urgency as any || 'NORMAL';
    document.status = 'ACTIVE' as any;
    document.tags = tags || [];
    document.isConfidential = false;
    document.requiresReview = this.getDocumentOptionByName(option)?.requiresReview || false;

    document.active = true;
    document.available = true;
    const now = new Date();
    document.createdAt = now;
    document.uploadedAt = now; // Set uploaded date when document is created
    document.uploadedBy = this.extractUserId(user);

    const documentCreated = await this.documentRepository.create(document);
    const documentCreatedEvent = new DocumentCreated(new Date(), documentCreated, { user });
    publish(documentCreatedEvent);
    return documentCreated;
  }

  public async activeDocument(user: string, id: string, active: boolean): Promise<Document> {
    const document = await this.getDocumentById(id);
    if (active !== undefined) {
      document.active = active;
    }
    return await this.update(user, document);
  }

  public async availableDocument(user: string, id: string, available: boolean): Promise<Document> {
    const document = await this.getDocumentById(id);
    if (available !== undefined) {
      document.available = available;
    }
    return await this.update(user, document);
  }

  public async getDocumentsByCommerceId(commerceId: string): Promise<Document[]> {
    const result = await this.documentRepository
      .whereEqualTo('commerceId', commerceId)
      .orderByAscending('type')
      .find();
    return result;
  }

  public async getDocumentsByOption(commerceId: string, option: string): Promise<Document> {
    const result = await this.documentRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('option', option)
      .findOne();
    return result;
  }

  public async getDocumentsByCommerceIdAndClient(
    commerceId: string,
    clientId: string,
    type: DocumentType
  ): Promise<Document[]> {
    const result = await this.documentRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .whereEqualTo('type', type)
      .find();
    return result;
  }

  public async getDocumentsByClientAndType(
    commerceId: string,
    clientId: string,
    type: DocumentType,
    option: string
  ): Promise<Document> {
    const result = await this.documentRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .whereEqualTo('type', type)
      .whereEqualTo('option', option)
      .findOne();
    return result;
  }

  public async update(user: string, document: Document): Promise<Document> {
    const documentUpdated = await this.documentRepository.update(document);
    const documentUpdatedEvent = new DocumentUpdated(new Date(), documentUpdated, { user });
    publish(documentUpdatedEvent);
    return documentUpdated;
  }

  public getDocument(documentKey: string, reportType: string): Readable {
    const S3 = new AWS.S3();
    const bucketAndPath = this.getBucketPath(reportType);
    const key = documentKey;
    const getObjectRequest: AWS.S3.GetObjectRequest = { Bucket: bucketAndPath, Key: key };
    try {
      return S3.getObject(getObjectRequest).createReadStream();
    } catch (error) {
      throw new HttpException('Objeto no encontrado', HttpStatus.NOT_FOUND);
    }
  }

  public getClientDocument(documentKey: string, reportType: string, name: string): Readable {
    const S3 = new AWS.S3();
    const bucketAndPath = this.getBucketPath(reportType);
    const key = `${documentKey}/${name}`;
    const getObjectRequest: AWS.S3.GetObjectRequest = { Bucket: bucketAndPath, Key: key };
    try {
      return S3.getObject(getObjectRequest).createReadStream();
    } catch (error) {
      throw new HttpException('Objeto no encontrado', HttpStatus.NOT_FOUND);
    }
  }

  public async uploadDocument(
    user: string,
    commerceId: string,
    reportType: string,
    filename: string,
    format: string,
    files: any
  ): Promise<any> {
    if (!files || files.length == 0) {
      throw new HttpException('Archivo no enviado', HttpStatus.NOT_FOUND);
    }

    const file = files[0];

    // FIX Path Traversal: Validate filename
    if (!validateFilename(filename)) {
      filename = generateSafeFilename(filename || file.originalname);
    }

    // FIX Image Validation: Validate content, not just MIME type
    if (format.startsWith('image/')) {
      const buffer = Buffer.from(file.buffer);
      const validation = validateImageContent(buffer);
      if (!validation.isValid) {
        throw new HttpException('Invalid image file content', HttpStatus.BAD_REQUEST);
      }
      // Override format with detected MIME type
      format = validation.mimeType;
    }

    // FIX PDF Validation: Scan for JavaScript
    if (format === 'application/pdf') {
      const buffer = Buffer.from(file.buffer);
      const validation = validatePDFContent(buffer);
      if (!validation.isValid) {
        throw new HttpException('Invalid PDF file', HttpStatus.BAD_REQUEST);
      }
      if (validation.hasJavaScript) {
        throw new HttpException('PDF contains JavaScript - not allowed', HttpStatus.BAD_REQUEST);
      }
    }

    // FIX File Size: Validate size limits
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new HttpException('File size exceeds 5MB limit', HttpStatus.BAD_REQUEST);
    }

    const S3 = new AWS.S3();
    const name = `${filename}.${format.split('/')[1]}`;
    await new Promise((resolve, reject) => {
      S3.upload(
        {
          Bucket: this.getBucketPath(reportType),
          Body: files[0].buffer,
          Key: name,
          ACL: 'private',
        },
        (error, result) => {
          if (error) {
            reject(error);
          }
          resolve(result);
        }
      );
    })
      .then(async () => {
        const result = await this.createDocument(user, name, commerceId, reportType, format);
        return result;
      })
      .catch(error => {
        throw new HttpException(
          `error subiendo archivo de comercio: ${error.message}`,
          HttpStatus.NOT_FOUND
        );
      });
  }

  public async uploadClientDocument(
    user: string,
    commerceId: string,
    clientId: string,
    reportType: string,
    filename: string,
    format: string,
    files: any,
    documentMetadata: DocumentMetadata,
    attentionId?: string,
    patientHistoryId?: string,
    collaboratorId?: string,
    category?: string,
    urgency?: string,
    tags?: string[]
  ): Promise<Document> {
    if (!files || files.length == 0) {
      throw new HttpException('Archivo no enviado', HttpStatus.NOT_FOUND);
    }

    const file = files[0];

    // FIX Path Traversal: Validate filename
    if (!validateFilename(filename)) {
      filename = generateSafeFilename(filename || file.originalname);
    }

    // FIX Image Validation: Validate content, not just MIME type
    if (format.startsWith('image/')) {
      const buffer = Buffer.from(file.buffer);
      const validation = validateImageContent(buffer);
      if (!validation.isValid) {
        throw new HttpException('Invalid image file content', HttpStatus.BAD_REQUEST);
      }
      format = validation.mimeType;
    }

    // FIX PDF Validation: Scan for JavaScript
    if (format === 'application/pdf') {
      const buffer = Buffer.from(file.buffer);
      const validation = validatePDFContent(buffer);
      if (!validation.isValid) {
        throw new HttpException('Invalid PDF file', HttpStatus.BAD_REQUEST);
      }
      if (validation.hasJavaScript) {
        throw new HttpException('PDF contains JavaScript - not allowed', HttpStatus.BAD_REQUEST);
      }
    }

    // FIX File Size: Validate size limits
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new HttpException('File size exceeds 5MB limit', HttpStatus.BAD_REQUEST);
    }

    const S3 = new AWS.S3();
    const name = `${filename}.${format.split('/')[1]}`;

    // Enhanced S3 upload with better organization
    const s3Key = `${commerceId}/${clientId}/${reportType}/${name}`;
    const fileSize = files[0].size;

    let uploadResult;

    // Debug logging for parameters
    console.log('Upload parameters:', {
      collaboratorIdType: typeof collaboratorId,
      collaboratorIdValue: collaboratorId,
      userType: typeof user,
      userValue: user,
      tagsType: typeof tags,
      tagsValue: tags
    });

    // Extract and sanitize user ID first - MUST be a string
    const extractedUserId = this.extractUserId(user);
    let sanitizedUserId = this.sanitizeMetadata(extractedUserId);
    // Double-check: ensure it's definitely a string
    if (typeof sanitizedUserId !== 'string') {
      console.warn('sanitizedUserId is not a string, forcing conversion:', typeof sanitizedUserId, sanitizedUserId);
      sanitizedUserId = String(sanitizedUserId || '');
    }

    // Sanitize collaboratorId - MUST be a string
    let sanitizedCollaboratorId = this.sanitizeMetadata(collaboratorId || extractedUserId || '');
    // Double-check: ensure it's definitely a string
    if (typeof sanitizedCollaboratorId !== 'string') {
      console.warn('sanitizedCollaboratorId is not a string, forcing conversion:', typeof sanitizedCollaboratorId, sanitizedCollaboratorId);
      sanitizedCollaboratorId = String(sanitizedCollaboratorId || '');
    }

    console.log('Final metadata values (before S3):', {
      sanitizedCollaboratorId: sanitizedCollaboratorId,
      sanitizedCollaboratorIdType: typeof sanitizedCollaboratorId,
      sanitizedUserId: sanitizedUserId,
      sanitizedUserIdType: typeof sanitizedUserId,
      collaboratorIdOriginal: collaboratorId,
      collaboratorIdOriginalType: typeof collaboratorId,
      userOriginal: user,
      userOriginalType: typeof user,
      extractedUserId: extractedUserId,
      extractedUserIdType: typeof extractedUserId
    });

    // Prepare all metadata values - ensure ALL are strings with explicit conversion
    const s3Metadata: { [key: string]: string } = {};

    // Helper to ensure value is always a string
    const ensureString = (val: any, defaultValue: string = ''): string => {
      const sanitized = this.sanitizeMetadata(val || defaultValue);
      return typeof sanitized === 'string' ? sanitized : String(sanitized || defaultValue);
    };

    s3Metadata.clientId = ensureString(clientId);
    s3Metadata.commerceId = ensureString(commerceId);
    s3Metadata.attentionId = ensureString(attentionId);
    s3Metadata.patientHistoryId = ensureString(patientHistoryId);
    s3Metadata.collaboratorId = sanitizedCollaboratorId; // Already validated above
    s3Metadata.category = ensureString(category, 'OTHER');
    s3Metadata.urgency = ensureString(urgency, 'NORMAL');
    s3Metadata.tags = ensureString(tags && Array.isArray(tags) ? tags.join(',') : tags);
    s3Metadata.user = sanitizedUserId; // Already validated above
    s3Metadata.uploadedAt = new Date().toISOString();

    // Final validation: ensure ALL values are strings (AWS requirement)
    // Create a completely new object to avoid any reference issues
    const finalMetadata: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(s3Metadata)) {
      // Triple-check: ensure it's a string
      if (typeof value !== 'string') {
        console.error(`❌ Metadata ${key} is NOT a string before S3 upload:`, typeof value, value);
        finalMetadata[key] = String(value || '').trim();
      } else {
        // Even if it's a string, ensure it's not empty and trim it
        finalMetadata[key] = value.trim() || '';
      }
    }

    // CRITICAL: Explicitly ensure collaboratorId and user are strings
    if (typeof finalMetadata.collaboratorId !== 'string') {
      console.error('❌ CRITICAL: collaboratorId is still not a string!', typeof finalMetadata.collaboratorId, finalMetadata.collaboratorId);
      finalMetadata.collaboratorId = String(finalMetadata.collaboratorId || sanitizedCollaboratorId || '').trim();
    }
    if (typeof finalMetadata.user !== 'string') {
      console.error('❌ CRITICAL: user is still not a string!', typeof finalMetadata.user, finalMetadata.user);
      finalMetadata.user = String(finalMetadata.user || sanitizedUserId || '').trim();
    }

    // Final type check - throw error if still not strings (should never happen)
    for (const [key, value] of Object.entries(finalMetadata)) {
      if (typeof value !== 'string') {
        throw new Error(`FATAL: Metadata ${key} is still not a string after all sanitization: ${typeof value}`);
      }
    }

    console.log('✅ Final S3 metadata (all strings):', Object.entries(finalMetadata).map(([k, v]) => `${k}: ${typeof v}="${v.substring(0, 50)}"`).join(', '));

    // Create a completely fresh plain object for AWS S3 (no prototypes, no references)
    const awsMetadata: { [key: string]: string } = {};
    for (const key in finalMetadata) {
      if (finalMetadata.hasOwnProperty(key)) {
        const value = finalMetadata[key];
        // Ensure it's a primitive string
        awsMetadata[key] = String(value).trim();
      }
    }

    // One final check before sending to AWS
    console.log('🔍 Pre-AWS metadata check:', {
      collaboratorId: { value: awsMetadata.collaboratorId, type: typeof awsMetadata.collaboratorId },
      user: { value: awsMetadata.user, type: typeof awsMetadata.user },
      allKeys: Object.keys(awsMetadata)
    });

    try {
      uploadResult = await new Promise((resolve, reject) => {
        S3.upload(
          {
            Bucket: this.getBucketPath(reportType),
            Body: files[0].buffer,
            Key: s3Key,
            ACL: 'private',
            ContentType: format,
            Metadata: awsMetadata, // Use the fresh plain object
          },
          (error, result) => {
            if (error) {
              reject(error);
            }
            resolve(result);
          }
        );
      });
    } catch (error) {
      throw new HttpException(
        `Error subiendo archivo de cliente: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    // Create document record with enhanced metadata
    const result = await this.createClientDocument(
      user,
      name,
      commerceId,
      clientId,
      reportType,
      format,
      documentMetadata,
      attentionId,
      patientHistoryId,
      collaboratorId,
      category,
      urgency,
      tags
    );

    // Update document with S3 location and file size
    result.location = uploadResult.Location;
    result.fileSize = fileSize;

    return await this.update(user, result);
  }

  public async getDocumentsList(
    reportType: string,
    documentKey: string
  ): Promise<AWS.S3.ObjectList> {
    const S3 = new AWS.S3();
    return new Promise((resolve, reject) => {
      S3.listObjectsV2(
        { Bucket: this.getBucketPath(reportType), Prefix: documentKey },
        (error, result) => {
          if (error) {
            return reject(error);
          }
          return resolve(result.Contents);
        }
      );
    });
  }

  /**
   * Automatically create a document record when medical orders, prescriptions, references, etc. are generated
   * This ensures all generated documents are tracked in the document management system
   */
  public async createGeneratedDocument(
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
  ): Promise<Document> {
    const document = new Document();
    document.commerceId = commerceId;
    document.clientId = clientId;
    document.name = documentData.name;
    document.originalName = documentData.name;
    document.type = DocumentType.CLIENT;
    document.option = documentType;

    // Set category based on document type
    const categoryMap = {
      'PRESCRIPTION': 'PRESCRIPTIONS',
      'MEDICAL_ORDER': 'MEDICAL_ORDERS',
      'MEDICAL_REFERENCE': 'REFERRALS',
      'CONSULTATION_NOTES': 'CONSULTATION_NOTES',
      'DISCHARGE_SUMMARY': 'DISCHARGE_SUMMARY'
    };
    document.category = (documentData.category || categoryMap[documentType]) as any;
    document.urgency = (documentData.urgency || 'NORMAL') as any;
    document.status = 'ACTIVE' as any;

    // Ecosystem integration
    document.attentionId = documentData.attentionId;
    document.patientHistoryId = documentData.patientHistoryId;
    document.collaboratorId = documentData.collaboratorId || this.extractUserId(user);

    // Set location - either file URL or mark as generated
    if (documentData.fileUrl) {
      document.location = documentData.fileUrl;
    } else {
      document.location = `generated://${documentType}/${Date.now()}`;
    }

    document.format = 'application/pdf'; // Most generated documents are PDFs
    document.tags = documentData.tags || [];
    document.isConfidential = false;
    document.requiresReview = false;
    document.active = true;
    document.available = true;

    // Comprehensive date tracking
    const now = new Date();
    document.createdAt = now;
    document.generatedAt = now;
    document.uploadedAt = documentData.fileUrl ? now : undefined;
    document.createdBy = this.extractUserId(user);
    document.generatedBy = this.extractUserId(user);
    document.uploadedBy = documentData.fileUrl ? this.extractUserId(user) : undefined;

    // Document metadata
    document.documentMetadata = {
      clientName: '',
      clientLastName: '',
      clientIdNumber: '',
      clientEmail: '',
      optionSelected: {},
      ...documentData.metadata
    };

    const documentCreated = await this.documentRepository.create(document);
    const documentCreatedEvent = new DocumentCreated(new Date(), documentCreated, { user });
    publish(documentCreatedEvent);

    return documentCreated;
  }

  /**
   * Track document access (view/preview) - creates CQRS event
   */
  public async trackDocumentAccess(
    documentId: string,
    userId: string,
    userType: 'collaborator' | 'client' | 'admin',
    accessType: 'view' | 'preview' | 'annotate',
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw new HttpException('Document not found', HttpStatus.NOT_FOUND);
    }

    // Update access log
    if (!document.accessLog) {
      document.accessLog = [];
    }

    const accessEntry = {
      userId,
      userType,
      accessType: accessType as any,
      accessedAt: new Date(),
      ipAddress,
      userAgent
    };

    document.accessLog.push(accessEntry);

    // Update last accessed fields
    document.lastAccessedAt = new Date();
    document.lastAccessedBy = userId;

    // Keep only last 100 access entries to prevent unbounded growth
    if (document.accessLog.length > 100) {
      document.accessLog = document.accessLog.slice(-100);
    }

    await this.documentRepository.update(document);

    // Publish CQRS event for document access
    const documentAccessedEvent = new DocumentAccessed(new Date(), {
      documentId: document.id,
      userId,
      userType,
      accessType,
      accessedAt: accessEntry.accessedAt,
      ipAddress,
      userAgent,
      document: {
        id: document.id,
        name: document.name,
        category: document.category,
        clientId: document.clientId,
        attentionId: document.attentionId,
        lastAccessedAt: document.lastAccessedAt,
        lastAccessedBy: document.lastAccessedBy
      }
    }, { user: userId });
    publish(documentAccessedEvent);

    // Also publish update event for projection sync
    const documentUpdatedEvent = new DocumentUpdated(new Date(), document, { user: userId });
    publish(documentUpdatedEvent);
  }

  /**
   * Track document download - creates CQRS event
   */
  public async trackDocumentDownload(
    documentId: string,
    userId: string,
    userType: 'collaborator' | 'client' | 'admin',
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw new HttpException('Document not found', HttpStatus.NOT_FOUND);
    }

    // Update access log
    if (!document.accessLog) {
      document.accessLog = [];
    }

    const accessEntry = {
      userId,
      userType,
      accessType: 'download' as any,
      accessedAt: new Date(),
      ipAddress,
      userAgent
    };

    document.accessLog.push(accessEntry);

    // Update last downloaded fields
    document.lastDownloadedAt = new Date();
    document.lastDownloadedBy = userId;

    // Keep only last 100 access entries
    if (document.accessLog.length > 100) {
      document.accessLog = document.accessLog.slice(-100);
    }

    await this.documentRepository.update(document);

    // Publish CQRS event for document download
    const documentDownloadedEvent = new DocumentDownloaded(new Date(), {
      documentId: document.id,
      userId,
      userType,
      downloadedAt: accessEntry.accessedAt,
      ipAddress,
      userAgent,
      document: {
        id: document.id,
        name: document.name,
        category: document.category,
        clientId: document.clientId,
        attentionId: document.attentionId,
        lastDownloadedAt: document.lastDownloadedAt,
        lastDownloadedBy: document.lastDownloadedBy
      }
    }, { user: userId });
    publish(documentDownloadedEvent);

    // Also publish update event for projection sync
    const documentUpdatedEvent = new DocumentUpdated(new Date(), document, { user: userId });
    publish(documentUpdatedEvent);
  }
}
