import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { ProfessionalRole } from 'src/shared/enums/professional-role.enum';

import ProfessionalCreated from './events/ProfessionalCreated';
import ProfessionalUpdated from './events/ProfessionalUpdated';
import { Professional, PersonalInfo, ProfessionalInfo, FinancialInfo } from './model/professional.entity';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';

@Injectable()
export class ProfessionalService {
  private readonly logger = new Logger(ProfessionalService.name);
  private readonly bucketName: string;

  constructor(
    @InjectRepository(Professional)
    private professionalRepository = getRepository(Professional)
  ) {
    AWS.config.update({
      apiVersion: '2006-03-01',
      region: process.env.AWS_DEFAULT_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    this.bucketName = process.env.AWS_S3_COMMERCE_BUCKET;
  }

  /**
   * Subir archivo a S3
   */
  private async uploadToS3(
    buffer: Buffer,
    key: string,
    mimeType: string,
    metadata?: any
  ): Promise<AWS.S3.ManagedUpload.SendData> {
    const s3 = new AWS.S3();
    // S3 Metadata values must be strings. Coerce everything to string.
    const meta: Record<string, string> = {};
    if (metadata && typeof metadata === 'object') {
      for (const [k, v] of Object.entries(metadata)) {
        meta[k] = v === undefined || v === null ? '' : String(v);
      }
    }
    return new Promise((resolve, reject) => {
      s3.upload(
        {
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          ACL: 'private',
          Metadata: meta,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
    });
  }

  /**
   * Obtener profesional por ID
   */
  public async getProfessionalById(id: string): Promise<Professional> {
    try {
      const professional = await this.professionalRepository.findById(id);
      if (!professional) {
        throw new HttpException(
          `Professional not found: ${id}`,
          HttpStatus.NOT_FOUND
        );
      }
      return professional;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error getting professional by id: ${id}`, error);
      throw new HttpException(
        `Error getting professional: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtener todos los profesionales
   */
  public async getProfessionals(): Promise<Professional[]> {
    try {
      return await this.professionalRepository.find();
    } catch (error) {
      this.logger.error('Error getting professionals', error);
      throw new HttpException(
        `Error getting professionals: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtener profesionales por business
   */
  public async getProfessionalsByBusiness(businessId: string): Promise<Professional[]> {
    try {
      return await this.professionalRepository
        .whereEqualTo('businessId', businessId)
        .find();
    } catch (error) {
      this.logger.error(`Error getting professionals by business: ${businessId}`, error);
      throw new HttpException(
        `Error getting professionals: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtener profesionales por commerce
   */
  public async getProfessionalsByCommerce(commerceId: string): Promise<Professional[]> {
    try {
      // Buscar profesionales donde commerceId coincida o esté en commercesId
      const byCommerceId = await this.professionalRepository
        .whereEqualTo('commerceId', commerceId)
        .find();

      const byCommercesArray = await this.professionalRepository
        .whereArrayContains('commercesId', commerceId)
        .find();

      // Combinar y eliminar duplicados
      const allProfessionals = [...byCommerceId, ...byCommercesArray];
      const uniqueProfessionals = allProfessionals.filter(
        (prof, index, self) => index === self.findIndex(p => p.id === prof.id)
      );

      return uniqueProfessionals;
    } catch (error) {
      this.logger.error(`Error getting professionals by commerce: ${commerceId}`, error);
      throw new HttpException(
        `Error getting professionals: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtener profesionales activos por commerce
   */
  public async getActiveProfessionalsByCommerce(commerceId: string): Promise<Professional[]> {
    try {
      const professionals = await this.getProfessionalsByCommerce(commerceId);
      return professionals.filter(prof => prof.active === true && prof.available === true);
    } catch (error) {
      this.logger.error(`Error getting active professionals by commerce: ${commerceId}`, error);
      throw new HttpException(
        `Error getting professionals: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtener profesionales por lista de IDs
   */
  public async getProfessionalsById(ids: string[]): Promise<Professional[]> {
    try {
      if (!ids || ids.length === 0) {
        return [];
      }
      const professionals = await Promise.all(
        ids.map(id => this.professionalRepository.findById(id).catch(() => null))
      );
      return professionals.filter(prof => prof !== null);
    } catch (error) {
      this.logger.error('Error getting professionals by ids', error);
      throw new HttpException(
        `Error getting professionals: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtener profesionales disponibles para un servicio
   */
  public async getAvailableProfessionalsForService(serviceId: string): Promise<Professional[]> {
    try {
      const allProfessionals = await this.professionalRepository
        .whereEqualTo('active', true)
        .whereEqualTo('available', true)
        .find();

      // Filtrar los que tienen el servicio en su lista o no tienen servicios específicos
      return allProfessionals.filter(prof => {
        if (!prof.professionalInfo?.servicesId || prof.professionalInfo.servicesId.length === 0) {
          return true; // Puede hacer todos los servicios
        }
        return prof.professionalInfo.servicesId.includes(serviceId);
      });
    } catch (error) {
      this.logger.error(`Error getting professionals for service: ${serviceId}`, error);
      throw new HttpException(
        `Error getting professionals: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Crear profesional
   */
  public async createProfessional(
    user: string,
    dto: CreateProfessionalDto
  ): Promise<Professional> {
    try {
      const professional = new Professional();
      professional.businessId = dto.businessId;
      professional.commerceId = dto.commerceId;
      professional.commercesId = dto.commercesId || [];
      
      // Convertir DTOs a objetos planos para Firestore
      professional.personalInfo = JSON.parse(JSON.stringify(dto.personalInfo)) as PersonalInfo;
      professional.professionalInfo = JSON.parse(JSON.stringify(dto.professionalInfo)) as ProfessionalInfo;
      professional.financialInfo = dto.financialInfo ? JSON.parse(JSON.stringify(dto.financialInfo)) as FinancialInfo : undefined;
      
      professional.active = dto.active !== undefined ? dto.active : true;
      professional.available = dto.available !== undefined ? dto.available : true;
      professional.createdAt = new Date();
      professional.createdBy = user;

      const created = await this.professionalRepository.create(professional);

      // Publicar evento
      const event = new ProfessionalCreated(new Date(), created, { user });
      publish(event);

      this.logger.log(`Professional created: ${created.id}`);
      return created;
    } catch (error) {
      this.logger.error('Error creating professional', error);
      throw new HttpException(
        `Error creating professional: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Crear profesional (método flexible para uso interno)
   * Acepta un objeto con cualquier estructura para facilitar la creación desde otros servicios
   */
  public async create(user: string, data: any): Promise<Professional> {
    try {
      const professional = new Professional();
      professional.businessId = data.businessId;
      professional.commerceId = data.commerceId;
      professional.commercesId = data.commercesId || [];
      
      // Información personal
      professional.personalInfo = data.personalInfo;
      professional.professionalInfo = data.professionalInfo;
      professional.financialInfo = data.financialInfo;
      
      // Campos de acceso directo
      professional.profilePhoto = data.profilePhoto || data.personalInfo?.profilePhoto;
      professional.digitalSignature = data.digitalSignature || data.personalInfo?.digitalSignature;
      
      // Relación con Collaborator
      professional.isCollaborator = data.isCollaborator || false;
      professional.collaboratorId = data.collaboratorId;
      
      // Rol unificado
      professional.role = data.role || data.professionalInfo?.role;
      
      // Datos médicos/profesionales
      if (data.medicalData) professional.medicalData = data.medicalData;
      
      // Estado
      professional.active = data.active !== undefined ? data.active : true;
      professional.available = data.available !== undefined ? data.available : true;
      
      // Auditoría
      professional.createdAt = new Date();
      professional.createdBy = user;

      const created = await this.professionalRepository.create(professional);

      // Publicar evento
      const event = new ProfessionalCreated(new Date(), created, { user });
      publish(event);

      this.logger.log(`Professional created: ${created.id} (isCollaborator: ${professional.isCollaborator})`);
      return created;
    } catch (error) {
      this.logger.error('Error creating professional (flexible method)', error);
      throw new HttpException(
        `Error creating professional: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Actualizar profesional
   */
  public async updateProfessional(
    user: string,
    id: string,
    dto: UpdateProfessionalDto
  ): Promise<Professional> {
    try {
      const professional = await this.getProfessionalById(id);

      // Actualizar campos
      if (dto.commerceId !== undefined) professional.commerceId = dto.commerceId;
      if (dto.commercesId !== undefined) professional.commercesId = dto.commercesId;
      if (dto.active !== undefined) professional.active = dto.active;
      if (dto.available !== undefined) professional.available = dto.available;

      // Actualizar objetos anidados (convertir a objetos planos para Firestore)
      if (dto.personalInfo) {
        professional.personalInfo = JSON.parse(JSON.stringify({
          ...professional.personalInfo,
          ...dto.personalInfo,
        }));
      }

      if (dto.professionalInfo) {
        professional.professionalInfo = JSON.parse(JSON.stringify({
          ...professional.professionalInfo,
          ...dto.professionalInfo,
        }));
      }

      if (dto.financialInfo) {
        professional.financialInfo = JSON.parse(JSON.stringify({
          ...professional.financialInfo,
          ...dto.financialInfo,
        }));
      }

      if (dto.medicalData) {
        professional.medicalData = JSON.parse(JSON.stringify({
          ...professional.medicalData,
          ...dto.medicalData,
        }));
      }

      professional.updatedAt = new Date();
      professional.updatedBy = user;

      const updated = await this.professionalRepository.update(professional);

      // Publicar evento
      const event = new ProfessionalUpdated(new Date(), updated, { user });
      publish(event);

      this.logger.log(`Professional updated: ${updated.id}`);
      return updated;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error updating professional: ${id}`, error);
      throw new HttpException(
        `Error updating professional: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Upload profile photo for professional
   */
  /**
   * Upload profile photo for professional
   */
  public async uploadProfilePhoto(
    user: any,
    id: string,
    photo: any
  ): Promise<{ photoUrl: string }> {
    try {
      const professional = await this.getProfessionalById(id);

      const ext = photo.originalname?.split('.')?.pop() || 'jpg';
      const timestamp = Date.now();
      const key = `professionals/${id}/profile-${timestamp}.${ext}`;

      const metadata = {
        professionalId: id,
        uploadedBy: user?.email || 'system',
        uploadDate: new Date().toISOString(),
      };

      await this.uploadToS3(photo.buffer, key, photo.mimetype, metadata);

      const photoUrl = `https://${this.bucketName}.s3.amazonaws.com/${key}`;
      
      // Actualizar en personalInfo
      if (!professional.personalInfo) {
        professional.personalInfo = {} as PersonalInfo;
      }
      professional.personalInfo.profilePhoto = photoUrl;

      await this.professionalRepository.update(professional);

      // Publicar evento
      const event = new ProfessionalUpdated(new Date(), professional, { user });
      publish(event);

      this.logger.log(`Profile photo uploaded for professional: ${id}`);
      return { photoUrl };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error uploading profile photo: ${id}`, error);
      throw new HttpException(
        `Error uploading profile photo: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get signed URL for profile photo
   */
  public async getProfilePhotoSignedUrl(
    id: string
  ): Promise<{ photoUrl: string | null }> {
    try {
      const professional = await this.getProfessionalById(id);

      if (!professional.personalInfo?.profilePhoto) {
        return { photoUrl: null };
      }

      // Extract key from URL
      const urlMatch = professional.personalInfo.profilePhoto.match(/professionals\/.+/);
      if (!urlMatch) {
        return { photoUrl: professional.personalInfo.profilePhoto };
      }

      const key = urlMatch[0];
      const s3 = new AWS.S3();
      const signedUrl = s3.getSignedUrl('getObject', {
        Bucket: this.bucketName,
        Key: key,
        Expires: 600,
      });

      return { photoUrl: signedUrl };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error getting profile photo URL: ${id}`, error);
      throw new HttpException(
        `Error getting profile photo URL: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Upload digital signature for professional
   */
  /**
   * Upload digital signature for professional
   */
  public async uploadDigitalSignature(
    user: any,
    id: string,
    signature: any
  ): Promise<{ signatureUrl: string }> {
    try {
      const professional = await this.getProfessionalById(id);

      const ext = signature.originalname?.split('.')?.pop() || 'png';
      const timestamp = Date.now();
      const key = `professionals/${id}/signature-${timestamp}.${ext}`;

      const metadata = {
        professionalId: id,
        uploadedBy: user?.email || 'system',
        uploadDate: new Date().toISOString(),
      };

      await this.uploadToS3(signature.buffer, key, signature.mimetype, metadata);

      const signatureUrl = `https://${this.bucketName}.s3.amazonaws.com/${key}`;
      
      // Actualizar en personalInfo
      if (!professional.personalInfo) {
        professional.personalInfo = {} as PersonalInfo;
      }
      professional.personalInfo.digitalSignature = signatureUrl;

      await this.professionalRepository.update(professional);

      // Publicar evento
      const event = new ProfessionalUpdated(new Date(), professional, { user });
      publish(event);

      this.logger.log(`Digital signature uploaded for professional: ${id}`);
      return { signatureUrl };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error uploading digital signature: ${id}`, error);
      throw new HttpException(
        `Error uploading digital signature: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get signed URL for digital signature
   */
  public async getDigitalSignatureSignedUrl(
    id: string
  ): Promise<{ signatureUrl: string | null }> {
    try {
      const professional = await this.getProfessionalById(id);

      if (!professional.personalInfo?.digitalSignature) {
        return { signatureUrl: null };
      }

      // Extract key from URL
      const urlMatch = professional.personalInfo.digitalSignature.match(/professionals\/.+/);
      if (!urlMatch) {
        return { signatureUrl: professional.personalInfo.digitalSignature };
      }

      const key = urlMatch[0];
      const s3 = new AWS.S3();
      const signedUrl = s3.getSignedUrl('getObject', {
        Bucket: this.bucketName,
        Key: key,
        Expires: 600,
      });

      return { signatureUrl: signedUrl };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error getting digital signature URL: ${id}`, error);
      throw new HttpException(
        `Error getting digital signature URL: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtener profesional con datos completos para documentos médicos
   * Retorna una estructura plana con todos los campos necesarios
   */
  public async getProfessionalForMedicalDocuments(id: string): Promise<{
    id: string;
    name: string;
    email: string;
    phone: string;
    specialties: string;
    crm: string;
    crmState: string;
    professionalTitle: string;
    digitalSignature: string;
    medicalData?: any;
  }> {
    try {
      const professional = await this.getProfessionalById(id);
      
      if (!professional.active) {
        this.logger.warn(`Attempting to use inactive professional for medical documents: ${id}`);
      }
      
      // Retornar estructura plana para compatibilidad con PDFs
      return {
        id: professional.id,
        name: professional.personalInfo?.name || '',
        email: professional.personalInfo?.email || '',
        phone: professional.personalInfo?.phone || '',
        specialties: professional.professionalInfo?.specialties?.join(', ') || '',
        crm: professional.medicalData?.medicalLicense || professional.professionalInfo?.license || '',
        crmState: professional.medicalData?.medicalLicenseState || professional.professionalInfo?.licenseState || '',
        professionalTitle: professional.medicalData?.professionalTitle || 'Dr.',
        digitalSignature: professional.personalInfo?.digitalSignature || '',
        medicalData: professional.medicalData,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error getting professional for medical documents: ${id}`, error);
      throw new HttpException(
        `Error getting professional: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
