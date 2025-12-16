import * as crypto from 'crypto';

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { CreateLaboratoryDto } from './dto/create-laboratory.dto';
import { Laboratory } from './model/laboratory.entity';

@Injectable()
export class LaboratoryService {
  constructor(
    @InjectRepository(Laboratory)
    private laboratoryRepository = getRepository(Laboratory)
  ) {}

  /**
   * Crear nuevo laboratorio
   */
  async createLaboratory(user: string, dto: CreateLaboratoryDto): Promise<Laboratory> {
    const laboratory = new Laboratory();
    laboratory.name = dto.name;
    laboratory.code = dto.code || this.generateCode(dto.name);
    laboratory.commerceId = dto.commerceId;
    laboratory.businessId = dto.businessId;
    laboratory.email = dto.email;
    laboratory.phone = dto.phone;
    laboratory.address = dto.address;
    laboratory.hl7Enabled = dto.hl7Enabled || false;
    laboratory.hl7ApiKey = dto.hl7ApiKey || this.generateApiKey();
    laboratory.hl7Endpoint = dto.hl7Endpoint;
    laboratory.integrationType = dto.integrationType || 'manual';
    laboratory.active = true;
    laboratory.available = true;
    laboratory.createdAt = new Date();
    laboratory.createdBy = user;
    laboratory.updatedAt = new Date();

    return await this.laboratoryRepository.create(laboratory);
  }

  /**
   * Obtener laboratorio por ID
   */
  async getLaboratoryById(id: string): Promise<Laboratory> {
    const laboratory = await this.laboratoryRepository.findById(id);
    if (!laboratory) {
      throw new HttpException('Laboratory not found', HttpStatus.NOT_FOUND);
    }
    return laboratory;
  }

  /**
   * Obtener laboratorio por API Key
   */
  async getLaboratoryByApiKey(apiKey: string): Promise<Laboratory> {
    const laboratories = await this.laboratoryRepository
      .whereEqualTo('hl7Enabled', true)
      .whereEqualTo('active', true)
      .whereEqualTo('hl7ApiKey', apiKey)
      .find();

    if (laboratories.length === 0) {
      throw new HttpException('Invalid API Key', HttpStatus.UNAUTHORIZED);
    }

    return laboratories[0];
  }

  /**
   * Obtener laboratorio por código
   */
  async getLaboratoryByCode(code: string): Promise<Laboratory | null> {
    const laboratories = await this.laboratoryRepository
      .whereEqualTo('code', code)
      .whereEqualTo('active', true)
      .find();

    return laboratories.length > 0 ? laboratories[0] : null;
  }

  /**
   * Listar laboratorios
   */
  async listLaboratories(
    commerceId?: string,
    businessId?: string,
    activeOnly = true
  ): Promise<Laboratory[]> {
    let query: any = this.laboratoryRepository;

    if (commerceId) {
      query = query.whereEqualTo('commerceId', commerceId);
    }

    if (businessId) {
      query = query.whereEqualTo('businessId', businessId);
    }

    if (activeOnly) {
      query = query.whereEqualTo('active', true);
    }

    return await query.find();
  }

  /**
   * Actualizar laboratorio
   */
  async updateLaboratory(
    user: string,
    id: string,
    updates: Partial<CreateLaboratoryDto>
  ): Promise<Laboratory> {
    const laboratory = await this.getLaboratoryById(id);

    if (updates.name) laboratory.name = updates.name;
    if (updates.code) laboratory.code = updates.code;
    if (updates.email) laboratory.email = updates.email;
    if (updates.phone) laboratory.phone = updates.phone;
    if (updates.address) laboratory.address = updates.address;
    if (updates.hl7Enabled !== undefined) laboratory.hl7Enabled = updates.hl7Enabled;
    if (updates.hl7Endpoint) laboratory.hl7Endpoint = updates.hl7Endpoint;
    if (updates.integrationType) laboratory.integrationType = updates.integrationType;

    // Regenerar API Key si se solicita
    if (updates.hl7ApiKey === 'REGENERATE') {
      laboratory.hl7ApiKey = this.generateApiKey();
    } else if (updates.hl7ApiKey) {
      laboratory.hl7ApiKey = updates.hl7ApiKey;
    }

    laboratory.updatedAt = new Date();
    laboratory.updatedBy = user;

    return await this.laboratoryRepository.update(laboratory);
  }

  /**
   * Generar código único para laboratorio
   */
  private generateCode(name: string): string {
    const normalized = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${normalized}-${random}`;
  }

  /**
   * Generar API Key seguro
   */
  private generateApiKey(): string {
    return `hl7_${crypto.randomBytes(32).toString('hex')}`;
  }
}
