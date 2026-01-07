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

import { BusinessLogo } from './model/business-logo.entity';
import BusinessLogoCreated from './events/BusinessLogoCreated';
import BusinessLogoUpdated from './events/BusinessLogoUpdated';
import BusinessLogoDeleted from './events/BusinessLogoDeleted';

@Injectable()
export class BusinessLogoService {
  constructor(
    @InjectRepository(BusinessLogo)
    private businessLogoRepository = getRepository(BusinessLogo)
  ) {
    AWS.config.update({
      apiVersion: '2006-03-01',
      region: process.env.AWS_DEFAULT_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
  }

  private readonly bucketName = process.env.AWS_S3_COMMERCE_BUCKET;
  private readonly logoFolder = 'business-logos';
  private readonly thumbnailFolder = 'business-logos/thumbnails';
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly thumbnailSize = 150;
  // Recommended size for business logos (similar to CommerceLogo component)
  private readonly recommendedWidth = 500;
  private readonly recommendedHeight = 460;

  /**
   * Get S3 key for business logo
   */
  private getLogoS3Key(businessId: string, filename: string): string {
    return `${this.logoFolder}/${businessId}/${filename}`;
  }

  /**
   * Get S3 key for business logo thumbnail
   */
  private getThumbnailS3Key(businessId: string, filename: string): string {
    const nameWithoutExt = filename.split('.')[0];
    return `${this.thumbnailFolder}/${businessId}/${nameWithoutExt}_thumb.jpg`;
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
   * Optimized for business logos (maintains aspect ratio similar to CommerceLogo)
   */
  private async generateThumbnail(imageBuffer: Buffer): Promise<Buffer> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      const aspectRatio = metadata.width / metadata.height;
      const targetAspectRatio = this.recommendedWidth / this.recommendedHeight; // ~1.087

      let thumbWidth, thumbHeight;

      if (aspectRatio > targetAspectRatio) {
        // Image is wider - fit to width
        thumbWidth = this.thumbnailSize;
        thumbHeight = Math.round(this.thumbnailSize / aspectRatio);
      } else {
        // Image is taller - fit to height
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
   * Optimize logo image for display (resize if needed)
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
          // Image is wider - fit to width
          if (width > this.recommendedWidth) {
            height = Math.round((height * this.recommendedWidth) / width);
            width = this.recommendedWidth;
          }
        } else {
          // Image is taller - fit to height
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
    // If optimization fails, return original
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
      throw new HttpException('Logo no encontrado', HttpStatus.NOT_FOUND);
    }
  }

  /**
   * Upload business logo
   */
  async uploadBusinessLogo(
    user: string,
    businessId: string,
    file: any,
    metadata?: any
  ): Promise<BusinessLogo> {
    // FIX Path Traversal: Validate original filename if provided
    if (file.originalname && !validateFilename(file.originalname)) {
      // Generate safe filename
      file.originalname = generateSafeFilename(file.originalname);
    }

    this.validateFile(file);

    // Generate unique filename (already safe, but double-check)
    const timestamp = Date.now();
    const extension = file.mimetype.split('/')[1];
    const filename = `business-${businessId}-${timestamp}.${extension}`;

    // FIX Path Traversal: Ensure generated filename is safe
    if (!validateFilename(filename)) {
      throw new HttpException('Error generando nombre de archivo seguro', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Generate S3 keys
    const logoS3Key = this.getLogoS3Key(businessId, filename);
    const thumbnailS3Key = this.getThumbnailS3Key(businessId, filename);

    try {
      // Optimize logo for display
      const optimizedBuffer = await this.optimizeLogo(file.buffer);

      // Generate thumbnail
      const thumbnailBuffer = await this.generateThumbnail(optimizedBuffer);

      // Upload optimized logo and thumbnail to S3
      const uploadMetadata = {
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
          aspectRatio: imageInfo.width / imageInfo.height,
        };
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }
        imageMetadata = {};
      }

      // Save logo metadata to database
      const businessLogo = new BusinessLogo();
      businessLogo.businessId = businessId;
      businessLogo.filename = filename;
      businessLogo.originalFilename = file.originalname || filename;
      businessLogo.mimeType = 'image/jpeg'; // Always JPEG after optimization
      businessLogo.size = optimizedBuffer.length;
      businessLogo.s3Key = logoS3Key;
      businessLogo.thumbnailS3Key = thumbnailS3Key;
      businessLogo.uploadDate = new Date();
      businessLogo.createdBy = user;
      businessLogo.createdAt = new Date();
      businessLogo.active = true;
      businessLogo.metadata = imageMetadata;

      const savedLogo = await this.businessLogoRepository.create(businessLogo);

      console.log(`✅ BusinessLogoService: Logo saved successfully - id: ${savedLogo.id}, businessId: ${businessId}, filename: ${filename}`);

      // Publish event
      const event = new BusinessLogoCreated(new Date(), savedLogo as any, { user });
      publish(event);

      return savedLogo as BusinessLogo;
    } catch (error) {
      throw new HttpException(
        `Error al subir logo del negocio: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get business logo by business ID
   */
  async getBusinessLogo(businessId: string): Promise<BusinessLogo | null> {
    try {
      const logo = await this.businessLogoRepository
        .whereEqualTo('businessId' as any, businessId)
        .whereEqualTo('active' as any, true)
        .orderByDescending('uploadDate' as any)
        .findOne();

      if (logo) {
        return logo as BusinessLogo;
      } else {
        return null;
      }
    } catch (error) {
      console.error(`Error searching for business logo:`, error);
      return null;
    }
  }

  /**
   * Get business logo by ID
   */
  async getBusinessLogoById(logoId: string): Promise<BusinessLogo> {
    const logo = await this.businessLogoRepository.findById(logoId);
    if (!logo) {
      throw new HttpException('Logo no encontrado', HttpStatus.NOT_FOUND);
    }
    return logo as BusinessLogo;
  }

  /**
   * Get business logo file stream
   */
  async getBusinessLogoStream(businessId: string, logoId: string): Promise<Readable> {
    const logo = await this.getBusinessLogoById(logoId);

    // Verify ownership
    if (logo.businessId !== businessId) {
      throw new HttpException('No autorizado', HttpStatus.FORBIDDEN);
    }

    return this.getFromS3(logo.s3Key);
  }

  /**
   * Get business logo thumbnail stream
   */
  async getBusinessLogoThumbnailStream(
    businessId: string,
    logoId: string
  ): Promise<Readable> {
    const logo = await this.getBusinessLogoById(logoId);
    if (!logo.thumbnailS3Key) {
      throw new HttpException('Miniatura no encontrada', HttpStatus.NOT_FOUND);
    }
    return this.getFromS3(logo.thumbnailS3Key);
  }

  /**
   * Delete business logo
   */
  async deleteBusinessLogo(
    user: string,
    businessId: string,
    logoId: string
  ): Promise<void> {
    const logo = await this.getBusinessLogoById(logoId);

    // Verify ownership
    if (logo.businessId !== businessId) {
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

      await this.businessLogoRepository.update(logo as any);

      // Publish event
      const event = new BusinessLogoDeleted(new Date(), logo as any, { user });
      publish(event);
    } catch (error) {
      throw new HttpException(
        `Error al eliminar logo del negocio: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Update business logo (replace existing)
   */
  async updateBusinessLogo(
    user: string,
    businessId: string,
    file: any,
    metadata?: any
  ): Promise<BusinessLogo> {
    // Delete existing logo if it exists
    const existingLogo = await this.getBusinessLogo(businessId);
    if (existingLogo) {
      await this.deleteBusinessLogo(user, businessId, existingLogo.id);
    }

    // Upload new logo
    const newLogo = await this.uploadBusinessLogo(user, businessId, file, metadata);
    return newLogo;
  }

  /**
   * Get signed URL for business logo
   */
  async getBusinessLogoSignedUrl(businessId: string): Promise<string | null> {
    const logo = await this.getBusinessLogo(businessId);
    if (!logo) {
      return null;
    }

    // Return relative path instead of absolute URL
    // Frontend will construct full URL using its VITE_BACKEND_URL
    const relativePath = `/business-logos/${businessId}/${logo.id}`;
    return relativePath;
  }
}












