import { Readable } from 'stream';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import * as sharp from 'sharp';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';
import {
  validateFilename,
  generateSafeFilename,
  validateImageContent,
} from '../shared/utils/security-utils';

import { PatientPhoto } from './model/patient-photo.entity';
import PatientPhotoCreated from './events/PatientPhotoCreated';
import PatientPhotoUpdated from './events/PatientPhotoUpdated';
import PatientPhotoDeleted from './events/PatientPhotoDeleted';

@Injectable()
export class PatientPhotoService {
  constructor(
    @InjectRepository(PatientPhoto)
    private patientPhotoRepository = getRepository(PatientPhoto)
  ) {
    AWS.config.update({
      apiVersion: '2006-03-01',
      region: process.env.AWS_DEFAULT_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
  }

  private readonly bucketName = process.env.AWS_S3_COMMERCE_BUCKET;
  private readonly photoFolder = 'patient-photos';
  private readonly thumbnailFolder = 'patient-photos/thumbnails';
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly thumbnailSize = 150;

  /**
   * Get S3 key for patient photo
   */
  private getPhotoS3Key(commerceId: string, clientId: string, filename: string): string {
    return `${this.photoFolder}/${commerceId}/${clientId}/${filename}`;
  }

  /**
   * Get S3 key for patient photo thumbnail
   */
  private getThumbnailS3Key(commerceId: string, clientId: string, filename: string): string {
    const nameWithoutExt = filename.split('.')[0];
    return `${this.thumbnailFolder}/${commerceId}/${clientId}/${nameWithoutExt}_thumb.jpg`;
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: any): void {
    if (!file) {
      throw new HttpException('No se proporcionó archivo', HttpStatus.BAD_REQUEST);
    }

    // FIX File Size: Validate size limits
    if (file.size > this.maxFileSize) {
      throw new HttpException(
        'El archivo es muy grande. Máximo 5MB permitido.',
        HttpStatus.BAD_REQUEST
      );
    }

    // FIX Image Validation: Validate content, not just MIME type
    if (file.buffer) {
      const buffer = Buffer.from(file.buffer);
      const validation = validateImageContent(buffer);
      if (!validation.isValid) {
        throw new HttpException(
          'Contenido de imagen inválido. El archivo no es una imagen válida.',
          HttpStatus.BAD_REQUEST
        );
      }
      // Override MIME type with detected type
      file.mimetype = validation.mimeType;
    }

    // Validate MIME type matches detected content
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new HttpException(
        'Tipo de archivo no válido. Use JPG, PNG o WebP.',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Generate thumbnail from image buffer
   */
  private async generateThumbnail(imageBuffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(imageBuffer)
        .resize(this.thumbnailSize, this.thumbnailSize, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch (error) {
      throw new HttpException(
        'Error al generar miniatura de la imagen',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Upload file to S3
   */
  private async uploadToS3(
    buffer: Buffer,
    key: string,
    mimeType: string,
    metadata?: any
  ): Promise<AWS.S3.ManagedUpload.SendData> {
    const s3 = new AWS.S3();

    return new Promise((resolve, reject) => {
      s3.upload(
        {
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          ACL: 'private',
          Metadata: metadata || {},
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  /**
   * Delete file from S3
   */
  private async deleteFromS3(key: string): Promise<void> {
    const s3 = new AWS.S3();

    return new Promise((resolve, reject) => {
      s3.deleteObject(
        {
          Bucket: this.bucketName,
          Key: key,
        },
        (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Get file stream from S3
   */
  private getFromS3(key: string): Readable {
    const s3 = new AWS.S3();
    const getObjectRequest: AWS.S3.GetObjectRequest = {
      Bucket: this.bucketName,
      Key: key,
    };

    try {
      return s3.getObject(getObjectRequest).createReadStream();
    } catch (error) {
      throw new HttpException('Foto no encontrada', HttpStatus.NOT_FOUND);
    }
  }

  /**
   * Upload patient photo
   */
  async uploadPatientPhoto(
    user: string,
    commerceId: string,
    clientId: string,
    file: any,
    metadata?: any
  ): Promise<PatientPhoto> {
    // FIX Path Traversal: Validate original filename if provided
    if (file.originalname && !validateFilename(file.originalname)) {
      // Generate safe filename
      file.originalname = generateSafeFilename(file.originalname);
    }

    this.validateFile(file);

    // Generate unique filename (already safe, but double-check)
    const timestamp = Date.now();
    const extension = file.mimetype.split('/')[1];
    const filename = `patient-${clientId}-${timestamp}.${extension}`;

    // FIX Path Traversal: Ensure generated filename is safe
    if (!validateFilename(filename)) {
      throw new HttpException('Error generando nombre de archivo seguro', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Generate S3 keys
    const photoS3Key = this.getPhotoS3Key(commerceId, clientId, filename);
    const thumbnailS3Key = this.getThumbnailS3Key(commerceId, clientId, filename);

    try {
      // Generate thumbnail
      const thumbnailBuffer = await this.generateThumbnail(file.buffer);

      // Upload original photo and thumbnail to S3
      const uploadMetadata = {
        commerceId,
        clientId,
        uploadedBy: user,
        uploadDate: new Date().toISOString(),
        ...metadata,
      };

      await Promise.all([
        this.uploadToS3(file.buffer, photoS3Key, file.mimetype, uploadMetadata),
        this.uploadToS3(thumbnailBuffer, thumbnailS3Key, 'image/jpeg', uploadMetadata),
      ]);

      // Get image dimensions
      let imageMetadata;
      try {
        const imageInfo = await sharp(file.buffer).metadata();

        // FIX Image Dimensions: Limit dimensions to prevent DoS
        const maxDimension = 10000; // 10k pixels max
        if (imageInfo.width > maxDimension || imageInfo.height > maxDimension) {
          throw new HttpException(
            `Dimensiones de imagen muy grandes. Máximo ${maxDimension}x${maxDimension} píxeles.`,
            HttpStatus.BAD_REQUEST
          );
        }

        imageMetadata = {
          width: imageInfo.width,
          height: imageInfo.height,
          capturedFrom: metadata?.capturedFrom || 'upload',
        };
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }
        imageMetadata = {
          capturedFrom: metadata?.capturedFrom || 'upload',
        };
      }

      // Save photo metadata to database
      const patientPhoto = new PatientPhoto();
      patientPhoto.commerceId = commerceId;
      patientPhoto.clientId = clientId;
      patientPhoto.filename = filename;
      patientPhoto.originalFilename = file.originalname || filename;
      patientPhoto.mimeType = file.mimetype;
      patientPhoto.size = file.size;
      patientPhoto.s3Key = photoS3Key;
      patientPhoto.thumbnailS3Key = thumbnailS3Key;
      patientPhoto.uploadDate = new Date();
      patientPhoto.createdBy = user;
      patientPhoto.createdAt = new Date();
      patientPhoto.active = true;
      patientPhoto.metadata = imageMetadata;

      const savedPhoto = await this.patientPhotoRepository.create(patientPhoto);

      console.error(`✅ PHOTO_DEBUG: Photo saved successfully - id: ${savedPhoto.id}, commerceId: ${commerceId}, clientId: ${clientId}, filename: ${filename}, active: ${savedPhoto.active}`);

      // Publish event
      const event = new PatientPhotoCreated(new Date(), savedPhoto as any, { user });
      publish(event);

      return savedPhoto as PatientPhoto;
    } catch (error) {
      throw new HttpException(
        `Error al subir foto del paciente: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get patient photo by commerce and client ID
   */
  async getPatientPhoto(commerceId: string, clientId: string): Promise<PatientPhoto | null> {
    try {
      // Use both console.log and console.error to ensure it shows up in logs
      console.log(`🔍 PHOTO_DEBUG: Service searching for photo - commerceId: ${commerceId}, clientId: ${clientId}`);
      console.error(`🔍 PHOTO_DEBUG: Service searching for photo - commerceId: ${commerceId}, clientId: ${clientId}`);

      // First, let's try to get all photos for this client to debug
      const allPhotos = await this.patientPhotoRepository
        .whereEqualTo('clientId' as any, clientId)
        .find();

      console.error(`🔍 PHOTO_DEBUG: Found ${allPhotos.length} total photos for clientId: ${clientId}`);
      if (allPhotos.length > 0) {
        allPhotos.forEach((p, i) => {
          console.error(`  PHOTO_DEBUG: Photo ${i}: id=${p.id}, commerceId=${p.commerceId}, active=${p.active}, uploadDate=${p.uploadDate}, filename=${p.filename}`);
        });
      }

      const photo = await this.patientPhotoRepository
        .whereEqualTo('commerceId' as any, commerceId)
        .whereEqualTo('clientId' as any, clientId)
        .whereEqualTo('active' as any, true)
        .orderByDescending('uploadDate' as any)
        .findOne();

      if (photo) {
        console.error(`✅ PHOTO_DEBUG: Photo found - id: ${photo.id}, filename: ${photo.filename}, active: ${photo.active}`);
        return photo as PatientPhoto;
      } else {
        console.error(`❌ PHOTO_DEBUG: No active photo found for commerceId: ${commerceId}, clientId: ${clientId}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ PHOTO_DEBUG: Error searching for photo:`, error);
      return null;
    }
  }

  /**
   * Get patient photo by ID
   */
  async getPatientPhotoById(photoId: string): Promise<PatientPhoto> {
    const photo = await this.patientPhotoRepository.findById(photoId);
    if (!photo) {
      throw new HttpException('Foto no encontrada', HttpStatus.NOT_FOUND);
    }
    return photo as PatientPhoto;
  }

  /**
   * Get patient photo file stream
   */
  async getPatientPhotoStream(commerceId: string, clientId: string, photoId: string): Promise<Readable> {
    const photo = await this.getPatientPhotoById(photoId);

    // Verify ownership
    if (photo.commerceId !== commerceId || photo.clientId !== clientId) {
      throw new HttpException('No autorizado', HttpStatus.FORBIDDEN);
    }

    return this.getFromS3(photo.s3Key);
  }

  /**
   * Get patient photo thumbnail stream
   */
  async getPatientPhotoThumbnailStream(
    commerceId: string,
    clientId: string,
    photoId: string
  ): Promise<Readable> {
    const photo = await this.getPatientPhotoById(photoId);
    if (!photo.thumbnailS3Key) {
      throw new HttpException('Miniatura no encontrada', HttpStatus.NOT_FOUND);
    }
    return this.getFromS3(photo.thumbnailS3Key);
  }

  /**
   * Delete patient photo
   */
  async deletePatientPhoto(
    user: string,
    commerceId: string,
    clientId: string,
    photoId: string
  ): Promise<void> {
    const photo = await this.getPatientPhotoById(photoId);

    // Verify ownership
    if (photo.commerceId !== commerceId || photo.clientId !== clientId) {
      throw new HttpException('No autorizado', HttpStatus.FORBIDDEN);
    }

    try {
      // Delete files from S3
      await Promise.all([
        this.deleteFromS3(photo.s3Key),
        photo.thumbnailS3Key ? this.deleteFromS3(photo.thumbnailS3Key) : Promise.resolve(),
      ]);

      // Mark as inactive in database (soft delete)
      photo.active = false;
      photo.modifiedBy = user;
      photo.modifiedAt = new Date();

      console.log(`🗑️ PatientPhotoService: Marking photo as inactive: ${photo.id}`);
      await this.patientPhotoRepository.update(photo as any);
      console.log(`✅ PatientPhotoService: Photo marked as inactive successfully`);

      // Publish event
      const event = new PatientPhotoDeleted(new Date(), photo as any, { user });
      publish(event);
    } catch (error) {
      throw new HttpException(
        `Error al eliminar foto del paciente: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Update patient photo (replace existing)
   */
  async updatePatientPhoto(
    user: string,
    commerceId: string,
    clientId: string,
    file: any,
    metadata?: any
  ): Promise<PatientPhoto> {
    console.log(`🔄 PatientPhotoService: Updating photo for commerceId: ${commerceId}, clientId: ${clientId}`);

    // Delete existing photo if it exists
    const existingPhoto = await this.getPatientPhoto(commerceId, clientId);
    if (existingPhoto) {
      console.log(`🗑️ PatientPhotoService: Deleting existing photo: ${existingPhoto.id}`);
      await this.deletePatientPhoto(user, commerceId, clientId, existingPhoto.id);
    } else {
      console.log(`🔄 PatientPhotoService: No existing photo found, creating new one`);
    }

    // Upload new photo
    const newPhoto = await this.uploadPatientPhoto(user, commerceId, clientId, file, metadata);
    console.log(`✅ PatientPhotoService: Update completed, new photo id: ${newPhoto.id}`);
    return newPhoto;
  }
}




