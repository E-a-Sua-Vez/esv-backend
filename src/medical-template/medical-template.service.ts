import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { CreateMedicalTemplateDto } from './dto/create-medical-template.dto';
import { ProcessTemplateDto } from './dto/process-template.dto';
import { SearchTemplateDto } from './dto/search-template.dto';
import { UpdateMedicalTemplateDto } from './dto/update-medical-template.dto';
import MedicalTemplateCreated from './events/MedicalTemplateCreated';
import MedicalTemplateUpdated from './events/MedicalTemplateUpdated';
import MedicalTemplateUsed from './events/MedicalTemplateUsed';
import { MedicalTemplate, TemplateType, TemplateScope } from './model/medical-template.entity';

@Injectable()
export class MedicalTemplateService {
  constructor(
    @InjectRepository(MedicalTemplate)
    private templateRepository = getRepository(MedicalTemplate)
  ) {}

  /**
   * Crear un nuevo template
   */
  async createTemplate(
    user: string,
    createDto: CreateMedicalTemplateDto
  ): Promise<MedicalTemplate> {
    const template = new MedicalTemplate();
    template.commerceId = createDto.commerceId;
    template.doctorId = createDto.doctorId;
    template.doctorName = createDto.doctorName;
    template.name = createDto.name;
    template.description = createDto.description;
    template.type = createDto.type;
    template.category = createDto.category;
    template.content = createDto.content;
    template.variables = createDto.variables as any;
    template.scope = createDto.scope || TemplateScope.PERSONAL;
    template.tags = createDto.tags || [];
    template.isFavorite = createDto.isFavorite || false;
    template.usageCount = 0;
    template.active = true;
    template.available = true;
    template.createdAt = new Date();
    template.createdBy = user;
    template.updatedAt = new Date();

    const created = await this.templateRepository.create(template);

    // Publicar evento
    const event = new MedicalTemplateCreated(new Date(), created, { user });
    publish(event);

    return created;
  }

  /**
   * Actualizar un template
   */
  async updateTemplate(
    user: string,
    id: string,
    updateDto: UpdateMedicalTemplateDto
  ): Promise<MedicalTemplate> {
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
    }

    // Verificar permisos (solo el creador puede editar templates personales)
    if (template.scope === TemplateScope.PERSONAL && template.doctorId !== user) {
      throw new HttpException('Unauthorized to update this template', HttpStatus.FORBIDDEN);
    }

    // Actualizar campos
    if (updateDto.name !== undefined) template.name = updateDto.name;
    if (updateDto.description !== undefined) template.description = updateDto.description;
    if (updateDto.type !== undefined) template.type = updateDto.type;
    if (updateDto.category !== undefined) template.category = updateDto.category;
    if (updateDto.content !== undefined) template.content = updateDto.content;
    if (updateDto.variables !== undefined) template.variables = updateDto.variables as any;
    if (updateDto.scope !== undefined) template.scope = updateDto.scope;
    if (updateDto.tags !== undefined) template.tags = updateDto.tags;
    if (updateDto.isFavorite !== undefined) template.isFavorite = updateDto.isFavorite;

    template.updatedAt = new Date();
    template.updatedBy = user;

    const updated = await this.templateRepository.update(template);

    // Publicar evento
    const event = new MedicalTemplateUpdated(new Date(), updated, { user });
    publish(event);

    return updated;
  }

  /**
   * Obtener template por ID
   */
  async getTemplateById(id: string): Promise<MedicalTemplate> {
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
    }
    return template;
  }

  /**
   * Buscar templates
   */
  async searchTemplates(
    commerceId: string,
    doctorId: string,
    searchDto: SearchTemplateDto
  ): Promise<{ templates: MedicalTemplate[]; total: number; page: number; limit: number }> {
    const {
      searchTerm,
      type,
      category,
      scope,
      tag,
      favoritesOnly,
      page = 1,
      limit = 20,
    } = searchDto;

    const query = this.templateRepository
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .whereEqualTo('commerceId', commerceId);

    // Filtrar por alcance: personal del doctor, del comercio, o global
    const scopeQuery = this.templateRepository
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .whereEqualTo('commerceId', commerceId);

    // Obtener todos los templates que el doctor puede ver
    const allTemplates = await scopeQuery.find();
    let filtered = allTemplates.filter(t => {
      // Templates personales del doctor
      if (t.scope === TemplateScope.PERSONAL && t.doctorId === doctorId) return true;
      // Templates del comercio
      if (t.scope === TemplateScope.COMMERCE) return true;
      // Templates globales
      if (t.scope === TemplateScope.GLOBAL) return true;
      return false;
    });

    // Aplicar filtros adicionales
    if (type) {
      filtered = filtered.filter(t => t.type === type);
    }

    if (category) {
      filtered = filtered.filter(t => t.category === category);
    }

    if (scope) {
      filtered = filtered.filter(t => t.scope === scope);
    }

    if (tag) {
      filtered = filtered.filter(t => t.tags && t.tags.includes(tag));
    }

    if (favoritesOnly) {
      filtered = filtered.filter(t => t.isFavorite);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        t =>
          t.name.toLowerCase().includes(term) ||
          t.description?.toLowerCase().includes(term) ||
          t.content.toLowerCase().includes(term) ||
          t.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }

    // Ordenar por favoritos primero, luego por uso, luego por nombre
    filtered.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
      return a.name.localeCompare(b.name);
    });

    // Paginación
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = filtered.slice(start, end);

    return {
      templates: paginated,
      total: filtered.length,
      page,
      limit,
    };
  }

  /**
   * Procesar template (reemplazar variables con valores)
   */
  async processTemplate(processDto: ProcessTemplateDto): Promise<{ processedContent: string }> {
    const template = await this.getTemplateById(processDto.templateId);
    let processedContent = template.content;

    // Reemplazar variables {{variableName}} con valores
    if (processDto.variables) {
      Object.keys(processDto.variables).forEach(key => {
        const value = processDto.variables[key];
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        processedContent = processedContent.replace(regex, value || '');
      });
    }

    // Reemplazar variables del sistema
    const now = new Date();
    processedContent = processedContent.replace(/\{\{date\}\}/g, now.toLocaleDateString('pt-BR'));
    processedContent = processedContent.replace(/\{\{time\}\}/g, now.toLocaleTimeString('pt-BR'));
    processedContent = processedContent.replace(/\{\{datetime\}\}/g, now.toLocaleString('pt-BR'));

    // Incrementar contador de uso
    template.usageCount = (template.usageCount || 0) + 1;
    template.lastUsedAt = new Date();
    await this.templateRepository.update(template);

    // Publicar evento de uso
    const event = new MedicalTemplateUsed(new Date(), {
      templateId: template.id,
      doctorId: template.doctorId,
      commerceId: template.commerceId,
      type: template.type,
    });
    publish(event);

    return { processedContent };
  }

  /**
   * Marcar/desmarcar como favorito
   */
  async toggleFavorite(user: string, id: string): Promise<MedicalTemplate> {
    const template = await this.getTemplateById(id);
    template.isFavorite = !template.isFavorite;
    template.updatedAt = new Date();
    template.updatedBy = user;

    return await this.templateRepository.update(template);
  }

  /**
   * Eliminar template
   */
  async deleteTemplate(user: string, id: string): Promise<void> {
    const template = await this.getTemplateById(id);

    // Verificar permisos
    if (template.scope === TemplateScope.PERSONAL && template.doctorId !== user) {
      throw new HttpException('Unauthorized to delete this template', HttpStatus.FORBIDDEN);
    }

    template.active = false;
    template.updatedAt = new Date();
    template.updatedBy = user;

    await this.templateRepository.update(template);
  }

  /**
   * Obtener templates más usados
   */
  async getMostUsedTemplates(
    commerceId: string,
    doctorId: string,
    limit = 10
  ): Promise<MedicalTemplate[]> {
    const result = await this.searchTemplates(commerceId, doctorId, {
      page: 1,
      limit: 100,
    });

    return result.templates
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, limit);
  }
}
