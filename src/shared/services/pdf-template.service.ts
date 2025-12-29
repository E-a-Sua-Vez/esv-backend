import { Injectable, Logger } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { PdfTemplate } from '../model/pdf-template.entity';

@Injectable()
export class PdfTemplateService {
  private readonly logger = new Logger(PdfTemplateService.name);

  constructor(
    @InjectRepository(PdfTemplate)
    private pdfTemplateRepository = getRepository(PdfTemplate)
  ) {}

  /**
   * Obtener template por defecto para un tipo de documento
   */
  async getDefaultTemplate(
    documentType: 'prescription' | 'exam_order' | 'reference',
    commerceId?: string
  ): Promise<PdfTemplate | null> {
    try {
      // Buscar template por defecto del commerce
      if (commerceId) {
        const commerceTemplate = await this.pdfTemplateRepository
          .whereEqualTo('documentType', documentType)
          .whereEqualTo('commerceId', commerceId)
          .whereEqualTo('isDefault', true)
          .whereEqualTo('active', true)
          .whereEqualTo('available', true)
          .findOne();

        if (commerceTemplate) {
          return commerceTemplate;
        }
      }

      // Buscar template global por defecto
      const globalTemplate = await this.pdfTemplateRepository
        .whereEqualTo('documentType', documentType)
        .whereEqualTo('scope', 'GLOBAL')
        .whereEqualTo('isDefault', true)
        .whereEqualTo('active', true)
        .whereEqualTo('available', true)
        .findOne();

      return globalTemplate || null;
    } catch (error) {
      this.logger.error(`Error getting default template: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Obtener template por ID
   */
  async getTemplateById(id: string): Promise<PdfTemplate | null> {
    try {
      return await this.pdfTemplateRepository.findById(id);
    } catch (error) {
      this.logger.error(`Error getting template by ID: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Crear template
   */
  async createTemplate(user: string, template: Partial<PdfTemplate>): Promise<PdfTemplate> {
    try {
      // Convertir el template a objeto plano usando JSON para eliminar prototipos personalizados
      // Esto es necesario porque Firestore no puede serializar instancias de clase DTO
      // JSON.parse/stringify elimina todos los prototipos personalizados
      const plainTemplate: any = JSON.parse(JSON.stringify(template));

      // Asegurar que las secciones tengan enabled por defecto si no está definido
      if (plainTemplate.header && plainTemplate.header.enabled === undefined) {
        plainTemplate.header.enabled = true;
      }
      if (plainTemplate.footer && plainTemplate.footer.enabled === undefined) {
        plainTemplate.footer.enabled = true;
      }
      if (plainTemplate.content && plainTemplate.content.enabled === undefined) {
        plainTemplate.content.enabled = true;
      }

      plainTemplate.createdAt = new Date();
      plainTemplate.createdBy = user;
      plainTemplate.usageCount = 0;
      plainTemplate.active = plainTemplate.active !== undefined ? plainTemplate.active : true;
      plainTemplate.available = plainTemplate.available !== undefined ? plainTemplate.available : true;

      // Crear instancia de PdfTemplate desde el objeto plano
      // Usar Object.assign para copiar todas las propiedades planas
      const newTemplate = new PdfTemplate();
      for (const key in plainTemplate) {
        if (plainTemplate.hasOwnProperty(key)) {
          (newTemplate as any)[key] = plainTemplate[key];
        }
      }

      return await this.pdfTemplateRepository.create(newTemplate);
    } catch (error) {
      this.logger.error(`Error creating template: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Actualizar template
   */
  async updateTemplate(
    user: string,
    id: string,
    template: Partial<PdfTemplate>
  ): Promise<PdfTemplate> {
    try {
      const existing = await this.pdfTemplateRepository.findById(id);
      if (!existing) {
        throw new Error('Template not found');
      }

      // Convertir el template a objeto plano usando JSON para eliminar prototipos personalizados
      const plainTemplate: any = JSON.parse(JSON.stringify(template));

      // Asegurar que las secciones tengan enabled por defecto si no está definido
      if (plainTemplate.header && plainTemplate.header.enabled === undefined) {
        plainTemplate.header.enabled = existing.header?.enabled !== undefined ? existing.header.enabled : true;
      }
      if (plainTemplate.footer && plainTemplate.footer.enabled === undefined) {
        plainTemplate.footer.enabled = existing.footer?.enabled !== undefined ? existing.footer.enabled : true;
      }
      if (plainTemplate.content && plainTemplate.content.enabled === undefined) {
        plainTemplate.content.enabled = existing.content?.enabled !== undefined ? existing.content.enabled : true;
      }

      plainTemplate.updatedAt = new Date();
      plainTemplate.updatedBy = user;

      // Asignar las propiedades del objeto plano al objeto existente
      Object.assign(existing, plainTemplate);

      return await this.pdfTemplateRepository.update(existing);
    } catch (error) {
      this.logger.error(`Error updating template: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Listar templates
   */
  async listTemplates(
    documentType?: 'prescription' | 'exam_order' | 'reference',
    commerceId?: string,
    scope?: 'GLOBAL' | 'COMMERCE' | 'PERSONAL'
  ): Promise<PdfTemplate[]> {
    try {
      let query = this.pdfTemplateRepository
        .whereEqualTo('active', true)
        .whereEqualTo('available', true);

      if (documentType) {
        query = query.whereEqualTo('documentType', documentType);
      }

      if (scope) {
        query = query.whereEqualTo('scope', scope);
      }

      if (commerceId && scope === 'COMMERCE') {
        query = query.whereEqualTo('commerceId', commerceId);
      }

      return await query.find();
    } catch (error) {
      this.logger.error(`Error listing templates: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Incrementar contador de uso
   */
  async incrementUsageCount(id: string): Promise<void> {
    try {
      const template = await this.pdfTemplateRepository.findById(id);
      if (template) {
        template.usageCount = (template.usageCount || 0) + 1;
        await this.pdfTemplateRepository.update(template);
      }
    } catch (error) {
      this.logger.error(`Error incrementing usage count: ${error.message}`, error.stack);
    }
  }

  /**
   * Generar preview del template (retorna URL del PDF generado)
   */
  async generatePreview(template: PdfTemplate): Promise<string> {
    try {
      this.logger.log(`Generating preview for template ${template.id} of type ${template.documentType}`);
      
      // Importar servicios de PDF dinámicamente según el tipo
      if (template.documentType === 'prescription') {
        const { PrescriptionPdfService } = await import('../../prescription/prescription-pdf.service');
        const pdfService = new PrescriptionPdfService();

        // Crear datos de ejemplo para preview (SOLO PARA PREVIEW, NO PARA PRODUCCIÓN)
        // Usamos 'as any' porque solo necesitamos campos mínimos para el preview
        // Agregar timestamp para forzar regeneración y evitar cache
        const timestamp = Date.now();
        const mockPrescription: any = {
          id: `preview-${timestamp}`,
          commerceId: template.id, // Usar template.id como commerceId para organizar previews
          clientId: 'preview-client',
          attentionId: 'preview-attention',
          doctorId: 'preview-doctor',
          doctorName: 'Dr. Ejemplo',
          doctorLicense: 'CRM 12345',
          date: new Date(),
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'active',
          active: true,
          available: true,
          createdAt: new Date(),
          createdBy: 'preview',
          updatedAt: new Date(),
          totalRefillsAllowed: 0,
          totalRefillsUsed: 0,
          dispensations: [],
          medications: [
            {
              medicationId: 'preview-med-1',
              medicationName: 'Paracetamol',
              commercialName: 'Tylenol',
              dosage: '500mg',
              frequency: 'Cada 8 horas',
              duration: 7,
              quantity: 21,
              route: 'Oral',
              instructions: 'Tomar con alimentos',
              refillsAllowed: 0,
              refillsUsed: 0,
            },
            {
              medicationId: 'preview-med-2',
              medicationName: 'Ibuprofeno',
              commercialName: 'Advil',
              dosage: '400mg',
              frequency: 'Cada 12 horas',
              duration: 5,
              quantity: 10,
              route: 'Oral',
              instructions: 'Tomar después de las comidas',
              refillsAllowed: 1,
              refillsUsed: 0,
            },
          ],
          instructions: 'Instrucciones generales de ejemplo para el preview del template.',
          observations: 'Observaciones de ejemplo para demostrar cómo se verá el documento.',
        };

        const result = await pdfService.generatePrescriptionPdf(
          mockPrescription,
          'Paciente Ejemplo',
          '123456789',
          'Clínica Ejemplo',
          'Av. Ejemplo 123, São Paulo - SP',
          '(11) 5555-1234',
          undefined, // logo
          undefined, // signature
          template
        );

        return result.pdfUrl;
      } else if (template.documentType === 'exam_order') {
        const { MedicalExamOrderPdfService } = await import('../../medical-exam-order/medical-exam-order-pdf.service');
        const pdfService = new MedicalExamOrderPdfService();

        // Crear datos de ejemplo para preview (SOLO PARA PREVIEW, NO PARA PRODUCCIÓN)
        // Agregar timestamp para forzar regeneración y evitar cache
        const timestamp = Date.now();
        const mockExamOrder: any = {
          id: `preview-${timestamp}`,
          commerceId: template.id, // Usar template.id como commerceId para organizar previews
          clientId: 'preview-client',
          attentionId: 'preview-attention',
          doctorId: 'preview-doctor',
          doctorName: 'Dr. Ejemplo',
          requestedAt: new Date(),
          priority: 'routine',
          type: 'laboratory',
          status: 'pending',
          active: true,
          available: true,
          createdAt: new Date(),
          createdBy: 'preview',
          updatedAt: new Date(),
          exams: [
            {
              examId: 'preview-exam-1',
              examName: 'Hemograma Completo',
              examCode: 'HEMO-001',
              preparation: 'Jejum de 8 horas',
              instructions: 'Traer orden médica',
            },
            {
              examId: 'preview-exam-2',
              examName: 'Glicemia',
              examCode: 'GLIC-001',
              preparation: 'Jejum de 12 horas',
              instructions: 'No tomar medicamentos antes del examen',
            },
          ],
          clinicalJustification: 'Justificación clínica de ejemplo para el preview.',
          scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };

        const result = await pdfService.generateExamOrderPdf(
          mockExamOrder,
          'Paciente Ejemplo',
          '123456789',
          'Clínica Ejemplo',
          'Av. Ejemplo 123, São Paulo - SP',
          '(11) 5555-1234',
          undefined,
          undefined,
          template,
          'CRM 12345' // doctorLicense para preview
        );

        this.logger.log(`Preview URL generated successfully for exam_order: ${result.pdfUrl}`);
        return result.pdfUrl;
      } else if (template.documentType === 'reference') {
        const { MedicalReferencePdfService } = await import('../../medical-reference/medical-reference-pdf.service');
        const pdfService = new MedicalReferencePdfService();

        // Crear datos de ejemplo para preview (SOLO PARA PREVIEW, NO PARA PRODUCCIÓN)
        // Agregar timestamp para forzar regeneración y evitar cache
        const timestamp = Date.now();
        const mockReference: any = {
          id: `preview-${timestamp}`,
          commerceId: template.id, // Usar template.id como commerceId para organizar previews
          clientId: 'preview-client',
          attentionId: 'preview-attention',
          doctorOriginId: 'preview-doctor',
          doctorOriginName: 'Dr. Ejemplo Origen',
          referenceDate: new Date(),
          specialtyDestination: 'Cardiología',
          doctorDestinationName: 'Dr. Destino',
          urgency: 'routine',
          status: 'pending',
          active: true,
          available: true,
          createdAt: new Date(),
          createdBy: 'preview',
          updatedAt: new Date(),
          reason: 'Motivo de referencia de ejemplo para el preview del template.',
          presumptiveDiagnosis: 'Diagnóstico presuntivo de ejemplo.',
          studiesPerformed: 'Estudios realizados de ejemplo.',
          currentTreatment: 'Tratamiento actual de ejemplo.',
          returnReport: 'Informe de retorno de ejemplo.',
        };

        const result = await pdfService.generateReferencePdf(
          mockReference,
          'Paciente Ejemplo',
          '123456789',
          'Clínica Ejemplo',
          'Av. Ejemplo 123, São Paulo - SP',
          '(11) 5555-1234',
          undefined,
          undefined,
          template,
          'CRM 12345' // doctorLicense para preview
        );

        this.logger.log(`Preview URL generated successfully: ${result.pdfUrl}`);
        return result.pdfUrl;
      }

      throw new Error(`Unknown document type: ${template.documentType}`);
    } catch (error) {
      this.logger.error(`Error generating preview for template ${template?.id}: ${error.message}`, error.stack);
      throw error;
    }
  }
}

