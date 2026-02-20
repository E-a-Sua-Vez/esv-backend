import { HttpException, HttpStatus, Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { AdministratorService } from 'src/administrator/administrator.service';
import { PermissionService } from 'src/permission/permission.service';
import { InternalMessageService } from 'src/internal-message/internal-message.service';
import { MessageCategory } from 'src/internal-message/model/message-category.enum';
import { MessagePriority } from 'src/internal-message/model/message-priority.enum';
import { Commerce } from 'src/commerce/model/commerce.entity';
import { ProfessionalRole } from 'src/shared/enums/professional-role.enum';
import { ProfessionalService } from 'src/professional/professional.service';

import { ServiceService } from '../service/service.service';

import { CollaboratorDetailsDto } from './dto/collaborator-details.dto';
import { CreateAssociatedProfessionalDto } from './dto/create-associated-professional.dto';
import CollaboratorCreated from './events/CollaboratorCreated';
import CollaboratorUpdated from './events/CollaboratorUpdated';
import { CollaboratorType } from './model/collaborator-type.enum';
import { Collaborator } from './model/collaborator.entity';
import { MedicalCollaboratorData, CollaboratorRole } from './model/collaborator-roles.enum';
import * as defaultPermissions from './model/default-permissions.json';

@Injectable()
export class CollaboratorService {
  constructor(
    @InjectRepository(Collaborator)
    private collaboratorRepository = getRepository(Collaborator),
    private administratorService: AdministratorService,
    private permissionService: PermissionService,
    private serviceService: ServiceService,
    @Inject(forwardRef(() => InternalMessageService))
    private readonly internalMessageService: InternalMessageService,
    @Inject(forwardRef(() => ProfessionalService))
    private readonly professionalService: ProfessionalService
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
   * NOTA: Este método está deprecado. La firma digital ahora está en Professional.
   */
  public async getDigitalSignatureSignedUrl(id: string): Promise<{ signatureUrl: string | null }> {
    const collaborator = await this.getCollaboratorById(id);
    if (!collaborator) {
      return { signatureUrl: null };
    }

    // Si tiene professionalId, la firma debe obtenerse de Professional
    if (collaborator.professionalId) {
      this.logger.warn(`Collaborator ${id} has linked professionalId. Digital signature should be retrieved from Professional entity.`);
    }

    return { signatureUrl: null };
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
        lastName: (collaborator as any).lastName,
        idNumber: (collaborator as any).idNumber,
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
        email: (collaborator as any).email,
        phone: (collaborator as any).phone,
        role: (collaborator as any).role,
        profilePhoto: (collaborator as any).profilePhoto,
        isProfessional: (collaborator as any).isProfessional ?? false,
        professionalId: (collaborator as any).professionalId,
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
        lastName: (collaborator as any).lastName,
        idNumber: (collaborator as any).idNumber,
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
        email: (collaborator as any).email,
        phone: (collaborator as any).phone,
        role: (collaborator as any).role,
        profilePhoto: (collaborator as any).profilePhoto,
        isProfessional: (collaborator as any).isProfessional ?? false,
        professionalId: (collaborator as any).professionalId,
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
    lastName?: string,
    idNumber?: string,
    role?: ProfessionalRole
  ): Promise<Collaborator> {
    const collaborator = await this.getCollaboratorById(id);
    if (name) {
      collaborator.name = name;
    }
    if (lastName !== undefined) {
      collaborator.lastName = lastName;
    }
    if (idNumber !== undefined) {
      (collaborator as any).idNumber = idNumber;
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
    if (role) {
      collaborator.role = role;
    }
    if (commercesId) {
      collaborator.commercesId = commercesId;
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
    servicesId: string[],
    role?: ProfessionalRole,
    lastName?: string,
    idNumber?: string
  ): Promise<Collaborator> {
    try {
      // Validar que idNumber sea obligatorio para colaboradores no bot
      if (!bot && !idNumber) {
        throw new HttpException('idNumber es obligatorio', HttpStatus.BAD_REQUEST);
      }

      const collaborator = new Collaborator();
      collaborator.name = name;
      if (lastName) {
        collaborator.lastName = lastName;
      }
      if (idNumber) {
        (collaborator as any).idNumber = idNumber;
      }
      collaborator.commerceId = commerceId;
      collaborator.commercesId = commercesId || [commerceId];
      collaborator.administratorId = '';
      collaborator.bot = bot;
      collaborator.type = type || CollaboratorType.STANDARD;
      // Role es requerido - si no se provee, usar STANDARD como default
      collaborator.role = role || ProfessionalRole.STANDARD;
      // Inicializar flags de relación con Professional
      (collaborator as any).isProfessional = false;
      (collaborator as any).professionalId = null;

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

      // Mensaje interno de bienvenida para el nuevo colaborador (no bot)
      if (!collaboratorCreated.bot) {
        try {
          // Determinar idioma según el comercio asociado (es/pt/en)
          let language: string = 'es';
          try {
            const commerceRepository = getRepository(Commerce);
            const commerce = await commerceRepository.findById(collaboratorCreated.commerceId);
            language = (commerce?.localeInfo?.language as any) || 'es';
          } catch {
            // Si falla, mantener idioma por defecto (es)
          }

          const titleByLang: Record<string, string> = {
            es: 'Bienvenido a Hub',
            pt: 'Bem-vindo ao Hub',
            en: 'Welcome to Hub',
          };

          const contentByLang: Record<string, string> = {
            es:
              `Hola ${collaboratorCreated.name || ''}, tu usuario colaborador en Hub ha sido creado correctamente. ` +
              `Ya puedes ingresar al panel interno para gestionar tus atenciones y reservas.`,
            pt:
              `Olá ${collaboratorCreated.name || ''}, seu usuário colaborador no Hub foi criado com sucesso. ` +
              `Você já pode acessar o painel interno para gerenciar seus atendimentos e reservas.`,
            en:
              `Hi ${collaboratorCreated.name || ''}, your collaborator user in Hub has been created successfully. ` +
              `You can now access the internal panel to manage your appointments and bookings.`,
          };

          const languageKey = ['es', 'pt', 'en'].includes(language) ? language : 'es';

          await this.internalMessageService.sendSystemNotification({
            category: MessageCategory.FEATURE_ANNOUNCEMENT,
            priority: MessagePriority.NORMAL,
            title: titleByLang[languageKey],
            content: contentByLang[languageKey],
            icon: 'bi-person',
            actionLink: '/interno',
            actionLabel: 'Ir al panel',
            recipientId: collaboratorCreated.id,
            recipientType: 'collaborator',
          } as any);
        } catch (e) {
          // No romper creación por fallo en mensaje interno
        }
      }

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
   * NOTA: Los datos médicos ahora están en Professional. Este método es legacy.
   */
  async getCollaboratorForMedicalDocuments(id: string): Promise<Collaborator> {
    const collaborator = await this.collaboratorRepository.findById(id);
    if (!collaborator || collaborator.active === false) {
      throw new HttpException('Colaborador not found', HttpStatus.NOT_FOUND);
    }

    // Collaborator ya no tiene medicalData, está en Professional
    return collaborator;
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
   * NOTA: Este método ahora solo actualiza metadata, los datos reales están en Professional
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

    // Si tiene professionalId asociado, los datos deben actualizarse en Professional, no aquí
    if (collaborator.professionalId) {
      this.logger.warn(`Collaborator ${id} has linked professionalId ${collaborator.professionalId}. Medical data should be updated in Professional entity.`);
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

      // Ya no se almacena en collaborator, debe ir a Professional
      if (collaborator.professionalId) {
        this.logger.warn(`Collaborator ${id} has linked professionalId ${collaborator.professionalId}. Digital signature should be updated in Professional entity.`);
      }

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
    role: ProfessionalRole
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
      collaborator.role === ProfessionalRole.DOCTOR ||
      collaborator.role === ProfessionalRole.SPECIALIST ||
      collaborator.isProfessional // Si tiene Professional asociado
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

  /**
   * Crear un Professional asociado a partir de un Collaborator existente
   *
   * Este método:
   * 1. Valida que el Collaborator existe y no tiene Professional asociado
   * 2. Crea un Professional con los datos del Collaborator
   * 3. Establece la relación bidireccional
   * 4. Emite los eventos correspondientes
   *
   * @param user - ID del usuario que realiza la acción
   * @param collaboratorId - ID del Collaborator
   * @param dto - Datos adicionales para el Professional
   * @returns El Collaborator actualizado con la relación
   */
  public async createAssociatedProfessional(
    user: string,
    collaboratorId: string,
    dto: CreateAssociatedProfessionalDto
  ): Promise<{ collaborator: Collaborator; professional: any }> {
    // 1. Validar Collaborator
    const collaborator = await this.getCollaboratorById(collaboratorId);
    if (!collaborator) {
      throw new HttpException('Colaborador no existe', HttpStatus.NOT_FOUND);
    }

    if ((collaborator as any).isProfessional) {
      throw new HttpException(
        'Este colaborador ya tiene un perfil profesional asociado',
        HttpStatus.BAD_REQUEST
      );
    }

    if (!this.professionalService) {
      throw new HttpException(
        'Servicio de Professional no disponible',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    try {
      // 2. Preparar datos del Professional desde el Collaborator
      const professionalData: any = {
        businessId: collaborator.commerceId, // Usar commerceId como businessId
        commerceId: collaborator.commerceId,
        commercesId: collaborator.commercesId || [collaborator.commerceId],

        // Datos personales desde Collaborator
        personalInfo: {
          name: collaborator.name,
          idNumber: (collaborator as any).idNumber || '',
          email: collaborator.email,
          phone: collaborator.phone,
          profilePhoto: (collaborator as any).profilePhoto,
        },

        // Datos profesionales
        professionalInfo: {
          role: dto.role || collaborator.role,
          specialties: dto.specialties || [],
          servicesId: dto.servicesId || collaborator.servicesId || [],
          license: dto.license,
          licenseType: dto.licenseType,
          licenseState: dto.licenseState,
        },

        // Datos financieros (si se proveen)
        financialInfo: dto.commissionType ? {
          commissionType: dto.commissionType,
          commissionValue: dto.commissionValue,
          paymentAccount: dto.paymentAccount,
        } : undefined,

        // Relación con Collaborator
        isCollaborator: true,
        collaboratorId: collaborator.id,
        role: dto.role || collaborator.role,

        // Datos médicos/profesionales (si aplica)
        medicalData: dto.medicalData,
        crm: dto.crm,
        crmState: dto.crmState,
        professionalTitle: dto.professionalTitle,
        department: dto.department,
        position: dto.position,
        workEmail: dto.workEmail,
        emergencyContact: dto.emergencyContact,
        canSignDocuments: dto.canSignDocuments || false,
        documentSignatureText: dto.documentSignatureText,

        // Estado
        active: true,
        available: dto.available !== undefined ? dto.available : true,

        // Auditoría
        createdBy: user,
      };

      // 3. Crear el Professional
      const professional = await this.professionalService.create(user, professionalData);

      // 4. Actualizar el Collaborator con la relación
      (collaborator as any).isProfessional = true;
      (collaborator as any).professionalId = professional.id;
      const updatedCollaborator = await this.update(user, collaborator);

      this.logger.log(
        `Professional ${professional.id} creado y asociado a Collaborator ${collaboratorId}`
      );

      return {
        collaborator: updatedCollaborator,
        professional,
      };
    } catch (error) {
      throw new HttpException(
        `Error al crear Professional asociado: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private readonly logger = new Logger(CollaboratorService.name);
}

