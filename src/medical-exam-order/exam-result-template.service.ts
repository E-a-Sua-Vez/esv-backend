import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { CreateExamResultTemplateDto } from './dto/create-exam-result-template.dto';
import { ExamResultTemplate } from './model/exam-result-template.entity';

@Injectable()
export class ExamResultTemplateService {
  constructor(
    @InjectRepository(ExamResultTemplate)
    private templateRepository = getRepository(ExamResultTemplate)
  ) {}

  /**
   * Crear template
   */
  async createTemplate(
    user: string,
    dto: CreateExamResultTemplateDto
  ): Promise<ExamResultTemplate> {
    const template = new ExamResultTemplate();
    template.examCode = dto.examCode;
    template.examName = dto.examName;
    template.examType = dto.examType;
    template.parameters = dto.parameters;
    template.normalRanges = dto.normalRanges || {};
    template.criticalValues = dto.criticalValues || {};
    template.commerceId = dto.commerceId;
    template.businessId = dto.businessId;
    template.active = true;
    template.available = true;
    template.createdAt = new Date();
    template.createdBy = user;
    template.updatedAt = new Date();

    return await this.templateRepository.create(template);
  }

  /**
   * Listar templates
   */
  async listTemplates(
    examCode?: string,
    commerceId?: string,
    businessId?: string,
    activeOnly = true
  ): Promise<ExamResultTemplate[]> {
    let query: any = this.templateRepository;

    if (examCode) {
      query = query.whereEqualTo('examCode', examCode);
    }

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
   * Obtener template por ID
   */
  async getTemplateById(id: string): Promise<ExamResultTemplate> {
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
    }
    return template;
  }

  /**
   * Actualizar template
   */
  async updateTemplate(
    user: string,
    id: string,
    updates: Partial<CreateExamResultTemplateDto>
  ): Promise<ExamResultTemplate> {
    const template = await this.getTemplateById(id);

    if (updates.examCode) template.examCode = updates.examCode;
    if (updates.examName) template.examName = updates.examName;
    if (updates.examType) template.examType = updates.examType;
    if (updates.parameters) template.parameters = updates.parameters;
    if (updates.normalRanges) template.normalRanges = updates.normalRanges;
    if (updates.criticalValues) template.criticalValues = updates.criticalValues;
    if (updates.commerceId !== undefined) template.commerceId = updates.commerceId;
    if (updates.businessId !== undefined) template.businessId = updates.businessId;

    template.updatedAt = new Date();
    template.updatedBy = user;

    return await this.templateRepository.update(template);
  }

  /**
   * Eliminar template
   */
  async deleteTemplate(id: string): Promise<void> {
    const template = await this.getTemplateById(id);
    template.active = false;
    template.available = false;
    await this.templateRepository.update(template);
  }
}
