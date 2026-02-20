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

import { CommerceLogo } from './model/commerce-logo.entity';
import CommerceLogoCreated from './events/CommerceLogoCreated';
import CommerceLogoUpdated from './events/CommerceLogoUpdated';
import CommerceLogoDeleted from './events/CommerceLogoDeleted';

@Injectable()
export class CommerceLogoService {
  constructor(
    @InjectRepository(CommerceLogo)
    private commerceLogoRepository = getRepository(CommerceLogo)
  ) {
    AWS.config.update({
      apiVersion: '2006-03-01',
      region: process.env.AWS_DEFAULT_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
  }

  private readonly bucketName = process.env.AWS_S3_COMMERCE_BUCKET;
  private readonly logoFolder = 'commerce-logos';
  private readonly thumbnailFolder = 'commerce-logos/thumbnails';
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly thumbnailSize = 150;
  // Recommended size for commerce logos (similar to CommerceLogo component)
  private readonly recommendedWidth = 500;
  private readonly recommendedHeight = 460;

  /**
   * Get S3 key for commerce logo
   */
  private getLogoS3Key(commerceId: string, filename: string): string {
    return `${this.logoFolder}/${commerceId}/${filename}`;
  }

  /**
   * Get S3 key for commerce logo thumbnail
   */
  private getThumbnailS3Key(commerceId: string, filename: string): string {
    const nameWithoutExt = filename.split('.')[0];
    return `${this.thumbnailFolder}/${commerceId}/${nameWithoutExt}_thumb.jpg`;
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: any): void {
    if (!file) {
      throw new HttpException('No se proporcionó archivo', HttpStatus.BAD_REQUEST);
    }

    // Validate size limits
    if (file.size > this.maxFileSize) {
      throw new HttpException(
        'El archivo es muy grande. Máximo 5MB permitido.',
        HttpStatus.BAD_REQUEST
      );
    }

    // Validate content, not just MIME type
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
      const metadata = await sharp(imageBuffer).metadata();
      const aspectRatio = metadata.width / metadata.height;
      const targetAspectRatio = this.recommendedWidth / this.recommendedHeight;

      let thumbWidth, thumbHeight;

      if (aspectRatio > targetAspectRatio) {
        thumbWidth = this.thumbnailSize;
        thumbHeight = Math.round(this.thumbnailSize / aspectRatio);
      } else {
        thumbHeight = this.thumbnailSize;
        thumbWidth = Math.round(this.thumbnailSize * aspectRatio);
      }

      return await sharp(imageBuffer)
        .resize(thumbWidth, thumbHeight, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
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
   * Optimize logo image for display
   */
  private async optimizeLogo(imageBuffer: Buffer): Promise<Buffer> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      const aspectRatio = metadata.width / metadata.height;
      const targetAspectRatio = this.recommendedWidth / this.recommendedHeight;

      let width = metadata.width;
      let height = metadata.height;

      // Resize if image is too large
      if (width > this.recommendedWidth || height > this.recommendedHeight) {
        if (aspectRatio > targetAspectRatio) {
          if (width > this.recommendedWidth) {
            height = Math.round((height * this.recommendedWidth) / width);
            width = this.recommendedWidth;
          }
        } else {
          if (height > this.recommendedHeight) {
            width = Math.round((width * this.recommendedHeight) / height);
            height = this.recommendedHeight;
          }
        }

      return await sharp(imageBuffer)
        .resize(width, height, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .jpeg({ quality: 90 })
        .toBuffer();
    } else {
      // No resize needed
      return imageBuffer;
    }
  } catch (error) {
    return imageBuffer;
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
      const stream = s3.getObject(getObjectRequest).createReadStream();

      // Asegura que siempre exista un handler de error para evitar que
      // errores como NoSuchKey tumben el proceso completo.
      stream.on('error', (error: any) => {
        console.error('Error leyendo logo de S3', {
          key,
          bucket: this.bucketName,
          code: error?.code,
          message: error?.message,
        });
      });

      return stream;
    } catch (error) {
      throw new HttpException('Logo no encontrado', HttpStatus.NOT_FOUND);
    }
  }

  /**
   * Upload commerce logo
   */
  async uploadCommerceLogo(
    user: string,
    commerceId: string,
    businessId: string,
    file: any,
    metadata?: any
  ): Promise<CommerceLogo> {
    // Validate original filename if provided
    if (file.originalname && !validateFilename(file.originalname)) {
      file.originalname = generateSafeFilename(file.originalname);
    }

    this.validateFile(file);

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.mimetype.split('/')[1];
    const filename = `commerce-${commerceId}-${timestamp}.${extension}`;

    // Ensure generated filename is safe
    if (!validateFilename(filename)) {
      throw new HttpException('Error generando nombre de archivo seguro', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Generate S3 keys
    const logoS3Key = this.getLogoS3Key(commerceId, filename);
    const thumbnailS3Key = this.getThumbnailS3Key(commerceId, filename);

    try {
      // Optimize logo for display
      const optimizedBuffer = await this.optimizeLogo(file.buffer);

      // Generate thumbnail
      const thumbnailBuffer = await this.generateThumbnail(optimizedBuffer);

      // Upload optimized logo and thumbnail to S3
      const uploadMetadata = {
        commerceId,
        businessId,
        uploadedBy: user,
        uploadDate: new Date().toISOString(),
        ...metadata,
      };

      await Promise.all([
        this.uploadToS3(optimizedBuffer, logoS3Key, 'image/jpeg', uploadMetadata),
        this.uploadToS3(thumbnailBuffer, thumbnailS3Key, 'image/jpeg', uploadMetadata),
      ]);

      // Get image dimensions
      let imageMetadata;
      try {
        const imageInfo = await sharp(optimizedBuffer).metadata();

        const maxDimension = 10000;
        if (imageInfo.width > maxDimension || imageInfo.height > maxDimension) {
          throw new HttpException(
            `Dimensiones de imagen muy grandes. Máximo ${maxDimension}x${maxDimension} píxeles.`,
            HttpStatus.BAD_REQUEST
          );
        }

        imageMetadata = {
          width: imageInfo.width,
          height: imageInfo.height,
          aspectRatio: imageInfo.width / imageInfo.height,
        };
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }
        imageMetadata = {};
      }

      // Save logo metadata to database
      const commerceLogo = new CommerceLogo();
      commerceLogo.commerceId = commerceId;
      commerceLogo.businessId = businessId;
      commerceLogo.filename = filename;
      commerceLogo.originalFilename = file.originalname || filename;
      commerceLogo.mimeType = 'image/jpeg';
      commerceLogo.size = optimizedBuffer.length;
      commerceLogo.s3Key = logoS3Key;
      commerceLogo.thumbnailS3Key = thumbnailS3Key;
      commerceLogo.uploadDate = new Date();
      commerceLogo.createdBy = user;
      commerceLogo.createdAt = new Date();
      commerceLogo.active = true;
      commerceLogo.metadata = imageMetadata;

      const savedLogo = await this.commerceLogoRepository.create(commerceLogo);
      // Publish event
      const event = new CommerceLogoCreated(new Date(), savedLogo as any, { user });
      publish(event);

      return savedLogo as CommerceLogo;
    } catch (error) {
      throw new HttpException(
        `Error al subir logo del comercio: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get commerce logo by commerce ID
   */
  async getCommerceLogo(commerceId: string): Promise<CommerceLogo | null> {
    try {
      const logo = await this.commerceLogoRepository
        .whereEqualTo('commerceId' as any, commerceId)
        .whereEqualTo('active' as any, true)
        .orderByDescending('uploadDate' as any)
        .findOne();

      if (logo) {
        return logo as CommerceLogo;
      } else {
        return null;
      }
    } catch (error) {
      console.error(`Error searching for commerce logo:`, error);
      return null;
    }
  }

  /**
   * Get commerce logo by ID
   */
  async getCommerceLogoById(logoId: string): Promise<CommerceLogo> {
    const logo = await this.commerceLogoRepository.findById(logoId);
    if (!logo) {
      throw new HttpException('Logo no encontrado', HttpStatus.NOT_FOUND);
    }
    return logo as CommerceLogo;
  }

  /**
   * Get commerce logo file stream
   */
  async getCommerceLogoStream(commerceId: string, logoId: string): Promise<Readable> {
    const logo = await this.getCommerceLogoById(logoId);

    // Verify ownership
    if (logo.commerceId !== commerceId) {
      throw new HttpException('No autorizado', HttpStatus.FORBIDDEN);
    }

    return this.getFromS3(logo.s3Key);
  }

  /**
   * Get commerce logo thumbnail stream
   */
  async getCommerceLogoThumbnailStream(
    commerceId: string,
    logoId: string
  ): Promise<Readable> {
    const logo = await this.getCommerceLogoById(logoId);
    if (!logo.thumbnailS3Key) {
      throw new HttpException('Miniatura no encontrada', HttpStatus.NOT_FOUND);
    }
    return this.getFromS3(logo.thumbnailS3Key);
  }

  /**
   * Delete commerce logo
   */
  async deleteCommerceLogo(
    user: string,
    commerceId: string,
    logoId: string
  ): Promise<void> {
    const logo = await this.getCommerceLogoById(logoId);

    // Verify ownership
    if (logo.commerceId !== commerceId) {
      throw new HttpException('No autorizado', HttpStatus.FORBIDDEN);
    }

    try {
      // Delete files from S3
      await Promise.all([
        this.deleteFromS3(logo.s3Key),
        logo.thumbnailS3Key ? this.deleteFromS3(logo.thumbnailS3Key) : Promise.resolve(),
      ]);

      // Mark as inactive in database (soft delete)
      logo.active = false;
      logo.modifiedBy = user;
      logo.modifiedAt = new Date();

      await this.commerceLogoRepository.update(logo as any);

      // Publish event
      const event = new CommerceLogoDeleted(new Date(), logo as any, { user });
      publish(event);
    } catch (error) {
      throw new HttpException(
        `Error al eliminar logo del comercio: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Update commerce logo (replace existing)
   */
  async updateCommerceLogo(
    user: string,
    commerceId: string,
    businessId: string,
    file: any,
    metadata?: any
  ): Promise<CommerceLogo> {
    // Delete existing logo if it exists
    const existingLogo = await this.getCommerceLogo(commerceId);
    if (existingLogo) {
      await this.deleteCommerceLogo(user, commerceId, existingLogo.id);
    }

    // Upload new logo
    const newLogo = await this.uploadCommerceLogo(user, commerceId, businessId, file, metadata);
    return newLogo;
  }

  /**
   * Get signed URL for commerce logo
   */
  async getCommerceLogoSignedUrl(commerceId: string): Promise<string | null> {
    const logo = await this.getCommerceLogo(commerceId);
    if (!logo) {
      return null;
    }

    // Return relative path instead of absolute URL
    // Frontend will construct full URL using its VITE_BACKEND_URL
    const relativePath = `/commerce-logos/${commerceId}/${logo.id}`;
    return relativePath;
  }

  /**
   * Get signed URL from S3 for commerce logo (for emails and external use)
   */
  async getCommerceLogoS3SignedUrl(commerceId: string, expiresInSeconds: number = 3600): Promise<string | null> {
    const logo = await this.getCommerceLogo(commerceId);
    if (!logo) {
      return null;
    }

    const s3 = new AWS.S3();
    try {
      const signedUrl = await new Promise<string>((resolve, reject) => {
        s3.getSignedUrl(
          'getObject',
          {
            Bucket: this.bucketName,
            Key: logo.s3Key,
            Expires: expiresInSeconds,
          },
          (err, url) => {
            if (err) reject(err);
            else resolve(url);
          }
        );
      });
      return signedUrl;
    } catch (error) {
      return null;
    }
  }
}
