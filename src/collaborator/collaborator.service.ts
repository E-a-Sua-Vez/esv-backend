import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { AdministratorService } from 'src/administrator/administrator.service';
import { PermissionService } from 'src/permission/permission.service';

import { ServiceService } from '../service/service.service';

import { CollaboratorDetailsDto } from './dto/collaborator-details.dto';
import CollaboratorCreated from './events/CollaboratorCreated';
import CollaboratorUpdated from './events/CollaboratorUpdated';
import { CollaboratorType } from './model/collaborator-type.enum';
import { CollaboratorRole, MedicalCollaboratorData } from './model/collaborator-roles.enum';
import { Collaborator } from './model/collaborator.entity';
import * as defaultPermissions from './model/default-permissions.json';

@Injectable()
export class CollaboratorService {
  constructor(
    @InjectRepository(Collaborator)
    private collaboratorRepository = getRepository(Collaborator),
    private administratorService: AdministratorService,
    private permissionService: PermissionService,
    private serviceService: ServiceService
  ) {
    AWS.config.update({
      apiVersion: '2006-03-01',
      region: process.env.AWS_DEFAULT_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
  }

  private readonly bucketName = process.env.AWS_S3_COMMERCE_BUCKET;

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

  public async getCollaboratorById(id: string): Promise<Collaborator> {
    const collaborator = await this.collaboratorRepository.findById(id);
    return collaborator;
  }

  /**
   * Obtener URL de foto de perfil firmada (si corresponde)
   */
  public async getProfilePhotoSignedUrl(id: string): Promise<{ photoUrl: string | null }> {
    const collaborator = await this.getCollaboratorById(id);
    if (!collaborator || !collaborator.profilePhoto) {
      return { photoUrl: null };
    }

    const rawUrl = collaborator.profilePhoto;
    // Si no hay bucket configurado, devolver tal cual
    if (!this.bucketName) {
      return { photoUrl: rawUrl };
    }

    // Intentar firmar si es un objeto en este bucket
    try {
      const url = new URL(rawUrl);
      const hostMatchesBucket = url.hostname.includes(this.bucketName);
      const key = decodeURIComponent(url.pathname.replace(/^\//, ''));

      if (!hostMatchesBucket || !key) {
        return { photoUrl: rawUrl };
      }

      const s3 = new AWS.S3();
      const signed = await new Promise<string>((resolve, reject) => {
        s3.getSignedUrl(
          'getObject',
          {
            Bucket: this.bucketName as string,
            Key: key,
            Expires: 60 * 10, // 10 minutos
          },
          (err, signedUrl) => {
            if (err) reject(err);
            else resolve(signedUrl);
          }
        );
      });
      return { photoUrl: signed };
    } catch (e) {
      // Si falla el parseo o firmado, devolver la URL sin firmar
      return { photoUrl: rawUrl };
    }
  }

  /**
   * Obtener URL de firma digital firmada (si corresponde)
   */
  public async getDigitalSignatureSignedUrl(id: string): Promise<{ signatureUrl: string | null }> {
    const collaborator = await this.getCollaboratorById(id);
    if (!collaborator || !collaborator.digitalSignature) {
      return { signatureUrl: null };
    }

    const rawUrl = collaborator.digitalSignature;
    if (!this.bucketName) {
      return { signatureUrl: rawUrl };
    }

    try {
      const url = new URL(rawUrl);
      const hostMatchesBucket = url.hostname.includes(this.bucketName);
      const key = decodeURIComponent(url.pathname.replace(/^\//, ''));

      if (!hostMatchesBucket || !key) {
        return { signatureUrl: rawUrl };
      }

      const s3 = new AWS.S3();
      const signed = await new Promise<string>((resolve, reject) => {
        s3.getSignedUrl(
          'getObject',
          {
            Bucket: this.bucketName as string,
            Key: key,
            Expires: 60 * 10,
          },
          (err, signedUrl) => {
            if (err) reject(err);
            else resolve(signedUrl);
          }
        );
      });
      return { signatureUrl: signed };
    } catch (e) {
      return { signatureUrl: rawUrl };
    }
  }

  public async getCollaboratorDetailsById(id: string): Promise<Collaborator> {
    const collaborator = await this.collaboratorRepository.findById(id);
    if (collaborator && collaborator.servicesId && collaborator.servicesId.length > 0) {
      collaborator.services = await this.serviceService.getServicesById(collaborator.servicesId);
    }
    return collaborator;
  }

  public async getCollaborators(): Promise<Collaborator[]> {
    const collaborators = await this.collaboratorRepository.find();
    return collaborators;
  }

  public async getCollaboratorByEmail(email: string): Promise<Collaborator> {
    const collaborators = await this.collaboratorRepository.whereEqualTo('email', email).find();
    const collaborator = collaborators[0];
    let userPermissions = {};
    if (collaborator) {
      if (collaborator.permissions) {
        userPermissions = collaborator.permissions;
      }
      const permissions = await this.permissionService.getPermissionsForCollaborator(
        collaborator.commerceId,
        userPermissions
      );
      if (permissions) {
        collaborator.permissions = permissions;
      }
    } else {
      throw new HttpException(`Colaborador no existe`, HttpStatus.NOT_FOUND);
    }
    return collaborator;
  }

  public async getCollaboratorBot(commerceId: string): Promise<Collaborator> {
    const collaborator = await this.collaboratorRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('bot', true)
      .find();
    return collaborator[0];
  }

  public async getCollaboratorsByCommerceId(commerceId: string): Promise<CollaboratorDetailsDto[]> {
    const collaborators = [];
    const result = await this.collaboratorRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('available', true)
      .orderByAscending('name')
      .find();
    for (let i = 0; i < result.length; i++) {
      const collaborator = result[i];
      if (collaborator.servicesId && collaborator.servicesId.length > 0) {
        collaborator.services = await this.serviceService.getServicesById(collaborator.servicesId);
      }
      const dto: CollaboratorDetailsDto = {
        id: collaborator.id,
        name: collaborator.name,
        active: collaborator.active,
        commerceId: collaborator.commerceId,
        commercesId: collaborator.commercesId,
        type: collaborator.type,
        alias: collaborator.alias,
        moduleId: collaborator.moduleId,
        bot: collaborator.bot,
        servicesId: collaborator.servicesId,
        available: collaborator.available,
        services: collaborator.services,
        role: (collaborator as any).role,
        profilePhoto: (collaborator as any).profilePhoto,
        digitalSignature: (collaborator as any).digitalSignature,
        crm: (collaborator as any).crm,
        crmState: (collaborator as any).crmState,
        canSignDocuments: (collaborator as any).canSignDocuments,
        medicalData: (collaborator as any).medicalData,
      };
      collaborators.push(dto as any);
    }
    return collaborators;
  }

  public async getDetailsCollaboratorsByCommerceId(
    commerceId: string
  ): Promise<CollaboratorDetailsDto[]> {
    const collaborators = [];
    const result = await this.collaboratorRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('available', true)
      .orderByAscending('name')
      .find();
    for (let i = 0; i < result.length; i++) {
      const collaborator = result[i];
      if (collaborator.servicesId && collaborator.servicesId.length > 0) {
        collaborator.services = await this.serviceService.getServicesById(collaborator.servicesId);
      }
      const collaboratorDetailsDto: CollaboratorDetailsDto = {
        id: collaborator.id,
        name: collaborator.name,
        active: collaborator.active,
        commerceId: collaborator.commerceId,
        commercesId: collaborator.commercesId,
        type: collaborator.type,
        alias: collaborator.alias,
        moduleId: collaborator.moduleId,
        bot: collaborator.bot,
        servicesId: collaborator.servicesId,
        available: collaborator.available,
        services: collaborator.services,
        role: (collaborator as any).role,
        profilePhoto: (collaborator as any).profilePhoto,
        digitalSignature: (collaborator as any).digitalSignature,
        crm: (collaborator as any).crm,
        crmState: (collaborator as any).crmState,
        canSignDocuments: (collaborator as any).canSignDocuments,
        medicalData: (collaborator as any).medicalData,
      };
      collaborators.push(collaboratorDetailsDto);
    }
    return collaborators;
  }

  public async getCollaboratorsByCommerceIdAndEmail(
    commerceId: string,
    email: string
  ): Promise<Collaborator> {
    try {
      const collaborator = await this.collaboratorRepository.whereEqualTo('email', email).findOne();
      if (collaborator) {
        let userPermissions = {};
        if (collaborator.commercesId && collaborator.commercesId.includes(commerceId)) {
          if (collaborator.permissions) {
            userPermissions = collaborator.permissions;
          }
          const permissions = await this.permissionService.getPermissionsForCollaborator(
            collaborator.commerceId,
            userPermissions
          );
          if (permissions) {
            collaborator.permissions = permissions;
          }
          return collaborator;
        } else {
          throw new HttpException(`Colaborador no existe`, HttpStatus.NOT_FOUND);
        }
      }
    } catch (error) {
      throw new HttpException(`Colaborador no existe: ${error.message}`, HttpStatus.NOT_FOUND);
    }
  }

  public async update(user: string, collaborator: Collaborator): Promise<Collaborator> {
    const collaboratorUpdated = await this.collaboratorRepository.update(collaborator);
    const collaboratorUpdatedEvent = new CollaboratorUpdated(new Date(), collaboratorUpdated, {
      user,
    });
    publish(collaboratorUpdatedEvent);
    return collaboratorUpdated;
  }

  public async updateCollaborator(
    user: string,
    id: string,
    name: string,
    moduleId: string,
    phone: string,
    active: boolean,
    available: boolean,
    alias: string,
    servicesId: string[],
    type: CollaboratorType,
    commercesId: string[],
    digitalSignature?: string,
    crm?: string,
    crmState?: string
  ): Promise<Collaborator> {
    const collaborator = await this.getCollaboratorById(id);
    if (name) {
      collaborator.name = name;
    }
    if (moduleId) {
      collaborator.moduleId = moduleId;
    }
    if (phone) {
      collaborator.phone = phone;
    }
    if (active !== undefined) {
      collaborator.active = active;
    }
    if (available !== undefined) {
      collaborator.available = available;
    }
    if (alias) {
      collaborator.alias = alias;
    }
    if (servicesId) {
      collaborator.servicesId = servicesId;
    }
    if (type) {
      collaborator.type = type;
    }
    if (commercesId) {
      collaborator.commercesId = commercesId;
    }
    if (digitalSignature !== undefined) {
      collaborator.digitalSignature = digitalSignature;
    }
    if (crm !== undefined) {
      collaborator.crm = crm;
    }
    if (crmState !== undefined) {
      collaborator.crmState = crmState;
    }
    if (commercesId && commercesId.length === 1) {
      collaborator.commerceId = commercesId[0];
    }
    return await this.update(user, collaborator);
  }

  public async updateToken(user: string, id: string, token: string): Promise<Collaborator> {
    const collaborator = await this.getCollaboratorById(id);
    collaborator.token = token;
    collaborator.lastSignIn = new Date();
    return await this.update(user, collaborator);
  }

  public async createCollaborator(
    user: string,
    name: string,
    commerceId: string,
    commercesId: string[],
    email: string,
    type: CollaboratorType,
    phone: string,
    moduleId: string,
    bot = false,
    alias: string,
    servicesId: string[]
  ): Promise<Collaborator> {
    try {
      const collaborator = new Collaborator();
      collaborator.name = name;
      collaborator.commerceId = commerceId;
      collaborator.commercesId = commercesId || [commerceId];
      collaborator.administratorId = '';
      collaborator.bot = bot;
      collaborator.type = type || CollaboratorType.STANDARD;
      if (collaborator.bot === true) {
        const collaboratorBot = await this.getCollaboratorBot(commerceId);
        if (collaboratorBot) {
          throw new HttpException(`Colaborador Bot ya existe`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        collaborator.email = 'bot@estuturno.app';
        collaborator.phone = '1111111111';
        collaborator.moduleId = 'N/A';
      } else {
        collaborator.email = email;
        collaborator.phone = phone;
        collaborator.moduleId = moduleId;
      }
      collaborator.active = true;
      collaborator.available = true;
      collaborator.alias = alias || name;
      if (defaultPermissions) {
        collaborator.permissions = defaultPermissions;
      }
      if (servicesId) {
        collaborator.servicesId = servicesId;
      }
      const collaboratorCreated = await this.collaboratorRepository.create(collaborator);
      const collaboratorCreatedEvent = new CollaboratorCreated(new Date(), collaboratorCreated, {
        user,
      });
      publish(collaboratorCreatedEvent);
      return collaboratorCreated;
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al crear el colaborador: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async changeStatus(user: string, id: string, action: boolean): Promise<Collaborator> {
    try {
      const collaborator = await this.collaboratorRepository.findById(id);
      collaborator.active = action;
      await this.administratorService.changeStatus(collaborator.administratorId, action);
      return await this.update(user, collaborator);
    } catch (error) {
      throw `Hubo un problema al activar o desactivar el colaborador: ${error.message}`;
    }
  }

  public async changePassword(user: string, id: string): Promise<Collaborator> {
    let collaborator = await this.collaboratorRepository.findById(id);
    if (collaborator) {
      if (!collaborator.firstPasswordChanged) {
        collaborator.firstPasswordChanged = true;
      }
      if (collaborator.lastPasswordChanged) {
        const days =
          Math.abs(new Date().getTime() - collaborator.lastPasswordChanged.getTime()) /
          (1000 * 60 * 60 * 24);
        if (days < 1) {
          throw new HttpException(
            'Limite de cambio de password alcanzado',
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        } else {
          collaborator.lastPasswordChanged = new Date();
          collaborator = await this.update(user, collaborator);
          return collaborator;
        }
      } else {
        collaborator.lastPasswordChanged = new Date();
        collaborator = await this.update(user, collaborator);
        return collaborator;
      }
    } else {
      throw new HttpException('Colaborador no existe', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async updateCollaboratorPermission(
    user: string,
    id: string,
    permissionName: string,
    permissionValue: boolean | number
  ): Promise<Collaborator> {
    const collaborator = await this.getCollaboratorById(id);
    if (collaborator) {
      if (!collaborator.permissions) {
        collaborator.permissions = {};
      }
      if (collaborator.permissions) {
        collaborator.permissions[permissionName] = permissionValue;
      }
    }
    return await this.update(user, collaborator);
  }

  // ========== NUEVOS MÉTODOS PARA GESTIÓN MÉDICA ==========

  /**
   * Obtener datos del colaborador para documentos médicos (método optimizado para PDFs)
   */
  async getCollaboratorForMedicalDocuments(id: string): Promise<Collaborator & {
    medicalData?: MedicalCollaboratorData;
  }> {
    const collaborator = await this.collaboratorRepository.findById(id);
    if (!collaborator || collaborator.active === false) {
      throw new HttpException('Colaborador not found', HttpStatus.NOT_FOUND);
    }

    return {
      ...collaborator,
      medicalData: collaborator.medicalData || undefined
    };
  }

  /**
   * Subir foto de perfil del colaborador (con archivo)
   */
  async uploadProfilePhoto(user: any, collaboratorId: string, photo: any): Promise<{ photoUrl: string }> {
    const collaborator = await this.collaboratorRepository.findById(collaboratorId);
    if (!collaborator || collaborator.active === false) {
      throw new HttpException('Colaborador not found', HttpStatus.NOT_FOUND);
    }

    try {
      const timestamp = Date.now();
      const ext = (photo.mimetype?.split('/')[1]) || (photo.originalname?.split('.').pop()) || 'jpg';
      const key = `collaborators/${collaboratorId}/profile-${timestamp}.${ext}`;

      const uploadedBy = typeof user === 'string' ? user : (user?.id || user?.sub || '');
      await this.uploadToS3(photo.buffer, key, photo.mimetype || 'image/jpeg', {
        collaboratorId,
        uploadedBy,
        uploadDate: new Date().toISOString(),
      });

      const bucketUrl = process.env.AWS_S3_PUBLIC_BASE_URL || `https://${this.bucketName}.s3.amazonaws.com`;
      const photoUrl = `${bucketUrl}/${key}`;

      await this.updateProfilePhoto(user, collaboratorId, photoUrl);

      return { photoUrl };
    } catch (error) {
      throw new HttpException(`Error uploading profile photo: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Actualizar datos médicos específicos del colaborador
   */
  public async updateMedicalData(
    user: string,
    id: string,
    medicalData: Partial<MedicalCollaboratorData>
  ): Promise<Collaborator> {
    const collaborator = await this.getCollaboratorById(id);
    if (!collaborator) {
      throw new HttpException('Colaborador no existe', HttpStatus.NOT_FOUND);
    }

    // Inicializar medicalData si no existe
    if (!collaborator.medicalData) {
      collaborator.medicalData = {} as MedicalCollaboratorData;
    }

    // Actualizar campos médicos
    collaborator.medicalData = {
      ...collaborator.medicalData,
      ...medicalData
    };

    // Si es médico y se proporciona información de licencia, actualizar campos legacy para compatibilidad
    if (medicalData.medicalLicense) {
      collaborator.crm = medicalData.medicalLicense;
      collaborator.crmState = medicalData.medicalLicenseState;
    }

    collaborator.updatedAt = new Date();
    collaborator.updatedBy = user;

    return await this.update(user, collaborator);
  }

  /**
   * Actualizar foto de perfil del colaborador
   */
  public async updateProfilePhoto(
    user: string,
    id: string,
    photoUrl: string
  ): Promise<Collaborator> {
    const collaborator = await this.getCollaboratorById(id);
    if (!collaborator) {
      throw new HttpException('Colaborador no existe', HttpStatus.NOT_FOUND);
    }

    collaborator.profilePhoto = photoUrl;
    collaborator.updatedAt = new Date();
    collaborator.updatedBy = user;

    return await this.update(user, collaborator);
  }

  /**
   * Subir firma digital del colaborador (con archivo)
   */
  public async uploadDigitalSignature(user: string, id: string, file: any): Promise<{ signatureUrl: string }> {
    const collaborator = await this.getCollaboratorById(id);
    if (!collaborator) {
      throw new HttpException('Colaborador no existe', HttpStatus.NOT_FOUND);
    }

    try {
      const timestamp = Date.now();
      const ext = (file.mimetype?.split('/')[1]) || (file.originalname?.split('.').pop()) || 'png';
      const key = `collaborators/${id}/signature-${timestamp}.${ext}`;

      const uploadedBy = typeof user === 'string' ? user : (user as any)?.id || (user as any)?.sub || '';
      await this.uploadToS3(file.buffer, key, file.mimetype || 'image/png', {
        collaboratorId: id,
        uploadedBy,
        uploadDate: new Date().toISOString(),
      });

      const bucketUrl = process.env.AWS_S3_PUBLIC_BASE_URL || `https://${this.bucketName}.s3.amazonaws.com`;
      const signatureUrl = `${bucketUrl}/${key}`;

      collaborator.digitalSignature = signatureUrl;
      collaborator.updatedAt = new Date();
      collaborator.updatedBy = user as any;
      await this.update(user, collaborator);

      return { signatureUrl };
    } catch (error) {
      throw new HttpException('Error uploading digital signature', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Actualizar rol del colaborador
   */
  public async updateCollaboratorRole(
    user: string,
    id: string,
    role: CollaboratorRole
  ): Promise<Collaborator> {
    const collaborator = await this.getCollaboratorById(id);
    if (!collaborator) {
      throw new HttpException('Colaborador no existe', HttpStatus.NOT_FOUND);
    }

    collaborator.role = role;
    collaborator.updatedAt = new Date();
    collaborator.updatedBy = user;

    return await this.update(user, collaborator);
  }

  /**
   * Obtener colaboradores médicos de un commerce (solo médicos con licencia)
   */
  public async getMedicalCollaboratorsByCommerceId(
    commerceId: string
  ): Promise<Collaborator[]> {
    const collaborators = await this.collaboratorRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .find();

    return collaborators.filter(collaborator =>
      collaborator.role === CollaboratorRole.DOCTOR ||
      collaborator.role === CollaboratorRole.SPECIALIST ||
      (collaborator.medicalData && collaborator.medicalData.medicalLicense)
    );
  }

  /**
   * Extender método updateCollaborator para incluir nuevos campos
   */
  public async updateCollaboratorExtended(
    user: string,
    id: string,
    updateData: Partial<Collaborator>
  ): Promise<Collaborator> {
    const collaborator = await this.getCollaboratorById(id);
    if (!collaborator) {
      throw new HttpException('Colaborador no existe', HttpStatus.NOT_FOUND);
    }

    // Actualizar campos básicos
    Object.assign(collaborator, updateData);

    // Establecer metadatos
    collaborator.updatedAt = new Date();
    collaborator.updatedBy = user;

    return await this.update(user, collaborator);
  }
}
