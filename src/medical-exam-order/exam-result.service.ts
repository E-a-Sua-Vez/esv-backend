import { Injectable, Logger } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { v4 as uuidv4 } from 'uuid';

import { ClinicalAlertsService } from '../clinical-alerts/clinical-alerts.service';
import { AlertType } from '../clinical-alerts/model/clinical-alert.entity';
import { NotificationType } from '../notification/model/notification-type.enum';
import { NotificationService } from '../notification/notification.service';

import { CreateExamResultDto, ExamValueDto } from './dto/create-exam-result.dto';
import { MedicalExamOrderService } from './medical-exam-order.service';
import {
  ExamResultTemplate,
  NormalRange,
  CriticalValue,
} from './model/exam-result-template.entity';
import { ExamResult, MedicalExamOrder } from './model/medical-exam-order.entity';

@Injectable()
export class ExamResultService {
  private readonly logger = new Logger(ExamResultService.name);

  constructor(
    @InjectRepository(ExamResultTemplate)
    private templateRepository = getRepository(ExamResultTemplate),
    private examOrderService: MedicalExamOrderService,
    private clinicalAlertsService: ClinicalAlertsService,
    private notificationService: NotificationService
  ) {}

  /**
   * Crear resultado estructurado
   */
  async createStructuredResult(userId: string, dto: CreateExamResultDto): Promise<ExamResult> {
    // Obtener orden de examen
    const examOrder = await this.examOrderService.getExamOrderById(dto.examOrderId);

    // Buscar template si existe
    let template: ExamResultTemplate | null = null;
    if (dto.examCode) {
      template = await this.findTemplateByExamCode(dto.examCode, examOrder.commerceId);
    }

    // Validar valores contra template si existe
    if (template) {
      this.validateValues(template, dto.values);
    }

    // Detectar valores anormales
    const abnormalValues = this.detectAbnormalValues(dto.values, template);

    // Crear resultado
    const result = new ExamResult();
    result.id = uuidv4();
    result.examId = dto.examOrderId;
    result.examName = dto.examName;
    result.examCode = dto.examCode;
    result.performedAt = dto.performedAt;
    result.resultDate = dto.resultDate;
    result.values = dto.values.map(v => ({
      parameter: v.parameter,
      value: v.value,
      unit: v.unit || '',
      referenceRange: v.referenceRange,
      status: v.status || this.calculateValueStatus(v, template),
      loincCode: v.loincCode,
    }));
    result.observations = dto.observations;
    result.interpretation = dto.interpretation;
    result.status = dto.status || 'final';
    result.attachments = dto.attachments || [];
    result.normalRange = dto.normalRange;
    result.criticalValues = abnormalValues.critical.map(
      v => `${v.parameter}: ${v.value} ${v.unit}`
    );
    result.uploadedBy = userId;
    result.uploadedAt = new Date();

    // Comparar con resultado anterior si existe
    if (examOrder.results && examOrder.results.length > 0) {
      const previousResult = examOrder.results[examOrder.results.length - 1];
      result.previousResultId = previousResult.id;
      result.comparisonNotes = this.compareWithPrevious(previousResult, result);
    }

    // Agregar resultado a la orden
    await this.examOrderService.addExamResults(userId, dto.examOrderId, [result]);

    // Crear alertas clínicas si hay valores anormales
    if (abnormalValues.critical.length > 0 || abnormalValues.warning.length > 0) {
      await this.createClinicalAlerts(examOrder, result, abnormalValues);
    }

    // Notificar al médico
    await this.notifyDoctor(examOrder, result, abnormalValues);

    return result;
  }

  /**
   * Validar valores contra template
   */
  private validateValues(template: ExamResultTemplate, values: ExamValueDto[]): void {
    const templateParams = new Map(template.parameters.map(p => [p.name.toLowerCase(), p]));

    for (const value of values) {
      const param = templateParams.get(value.parameter.toLowerCase());
      if (!param) {
        this.logger.warn(`Parameter ${value.parameter} not found in template`);
        continue;
      }

      if (param.required && !value.value) {
        throw new Error(`Required parameter ${value.parameter} is missing`);
      }

      // Validar tipo de dato
      if (param.dataType === 'numeric' && typeof value.value !== 'number') {
        const numValue = parseFloat(value.value as string);
        if (isNaN(numValue)) {
          throw new Error(`Parameter ${value.parameter} must be numeric`);
        }
      }
    }
  }

  /**
   * Detectar valores anormales
   */
  private detectAbnormalValues(
    values: ExamValueDto[],
    template: ExamResultTemplate | null
  ): { critical: ExamValueDto[]; warning: ExamValueDto[] } {
    const critical: ExamValueDto[] = [];
    const warning: ExamValueDto[] = [];

    for (const value of values) {
      if (!template) {
        // Sin template, usar status del DTO
        if (value.status === 'critical') {
          critical.push(value);
        } else if (value.status === 'high' || value.status === 'low') {
          warning.push(value);
        }
        continue;
      }

      // Verificar contra template
      const normalRange = template.normalRanges[value.parameter];
      const criticalValue = template.criticalValues[value.parameter];

      if (!normalRange) continue;

      const numValue =
        typeof value.value === 'number' ? value.value : parseFloat(value.value as string);

      if (isNaN(numValue)) continue;

      // Verificar valores críticos primero
      if (criticalValue) {
        if (criticalValue.type === 'high' && numValue >= (criticalValue.value || Infinity)) {
          critical.push(value);
          continue;
        }
        if (criticalValue.type === 'low' && numValue <= (criticalValue.value || -Infinity)) {
          critical.push(value);
          continue;
        }
      }

      // Verificar rango normal
      const min = normalRange.min ?? parseFloat(normalRange.minText || '0');
      const max = normalRange.max ?? parseFloat(normalRange.maxText || 'Infinity');

      if (numValue < min || numValue > max) {
        warning.push(value);
      }
    }

    return { critical, warning };
  }

  /**
   * Calcular status de valor
   */
  private calculateValueStatus(
    value: ExamValueDto,
    template: ExamResultTemplate | null
  ): 'normal' | 'high' | 'low' | 'critical' {
    if (!template) return 'normal';

    const normalRange = template.normalRanges[value.parameter];
    const criticalValue = template.criticalValues[value.parameter];

    if (!normalRange) return 'normal';

    const numValue =
      typeof value.value === 'number' ? value.value : parseFloat(value.value as string);

    if (isNaN(numValue)) return 'normal';

    // Verificar crítico
    if (criticalValue) {
      if (criticalValue.type === 'high' && numValue >= (criticalValue.value || Infinity)) {
        return 'critical';
      }
      if (criticalValue.type === 'low' && numValue <= (criticalValue.value || -Infinity)) {
        return 'critical';
      }
    }

    // Verificar rango normal
    const min = normalRange.min ?? parseFloat(normalRange.minText || '0');
    const max = normalRange.max ?? parseFloat(normalRange.maxText || 'Infinity');

    if (numValue < min) return 'low';
    if (numValue > max) return 'high';

    return 'normal';
  }

  /**
   * Comparar con resultado anterior
   */
  private compareWithPrevious(previous: ExamResult, current: ExamResult): string {
    const notes: string[] = [];

    if (!previous.values || !current.values) return '';

    const previousMap = new Map(previous.values.map(v => [v.parameter, v]));
    const currentMap = new Map(current.values.map(v => [v.parameter, v]));

    for (const [param, currentValue] of currentMap) {
      const prevValue = previousMap.get(param);
      if (!prevValue) continue;

      const prevNum =
        typeof prevValue.value === 'number'
          ? prevValue.value
          : parseFloat(prevValue.value as string);
      const currNum =
        typeof currentValue.value === 'number'
          ? currentValue.value
          : parseFloat(currentValue.value as string);

      if (isNaN(prevNum) || isNaN(currNum)) continue;

      const variation = ((currNum - prevNum) / prevNum) * 100;

      if (Math.abs(variation) > 20) {
        notes.push(
          `${param}: ${variation > 0 ? '+' : ''}${variation.toFixed(1)}% ` +
            `(${prevValue.value} → ${currentValue.value} ${currentValue.unit})`
        );
      }
    }

    return notes.join('; ');
  }

  /**
   * Crear alertas clínicas
   */
  private async createClinicalAlerts(
    examOrder: MedicalExamOrder,
    result: ExamResult,
    abnormalValues: { critical: ExamValueDto[]; warning: ExamValueDto[] }
  ): Promise<void> {
    try {
      for (const value of abnormalValues.critical) {
        await this.clinicalAlertsService.createAlert(examOrder.doctorId, {
          commerceId: examOrder.commerceId,
          clientId: examOrder.clientId,
          type: AlertType.EXAM_RESULT_CRITICAL,
          severity: 'critical' as any,
          title: `Valor Crítico en ${result.examName}`,
          message: `${value.parameter}: ${value.value} ${value.unit} está fuera del rango crítico`,
          details: `${value.parameter}: ${value.value} ${value.unit} está fuera del rango crítico`,
          context: {
            examOrderId: examOrder.id,
            examResultId: result.id,
            parameter: value.parameter,
            value: value.value,
            unit: value.unit,
          },
        });
      }

      for (const value of abnormalValues.warning) {
        await this.clinicalAlertsService.createAlert(examOrder.doctorId, {
          commerceId: examOrder.commerceId,
          clientId: examOrder.clientId,
          type: AlertType.EXAM_RESULT_ABNORMAL,
          severity: 'warning' as any,
          title: `Valor Anormal en ${result.examName}`,
          message: `${value.parameter}: ${value.value} ${value.unit} está fuera del rango normal`,
          details: `${value.parameter}: ${value.value} ${value.unit} está fuera del rango normal`,
          context: {
            examOrderId: examOrder.id,
            examResultId: result.id,
            parameter: value.parameter,
            value: value.value,
            unit: value.unit,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error creating clinical alerts: ${error.message}`);
    }
  }

  /**
   * Notificar al médico
   */
  private async notifyDoctor(
    examOrder: MedicalExamOrder,
    result: ExamResult,
    abnormalValues: { critical: ExamValueDto[]; warning: ExamValueDto[] }
  ): Promise<void> {
    try {
      const hasCritical = abnormalValues.critical.length > 0;
      const hasWarning = abnormalValues.warning.length > 0;

      let title = 'Resultado de Examen Recibido';
      let message = `Se recibieron resultados para ${result.examName}`;

      if (hasCritical) {
        title = '⚠️ Valores Críticos Detectados';
        message = `${result.examName}: ${abnormalValues.critical.length} valor(es) crítico(s) detectado(s)`;
      } else if (hasWarning) {
        title = 'Resultado con Valores Anormales';
        message = `${result.examName}: ${abnormalValues.warning.length} valor(es) anormal(es)`;
      }

      await this.notificationService.createNotification({
        userId: examOrder.doctorId,
        type: hasCritical
          ? NotificationType.EXAM_RESULT_CRITICAL
          : NotificationType.EXAM_RESULT_RECEIVED,
        title,
        message,
        data: {
          examOrderId: examOrder.id,
          examResultId: result.id,
          examName: result.examName,
          hasCritical,
          hasWarning,
        },
        commerceId: examOrder.commerceId,
      });
    } catch (error) {
      this.logger.error(`Error notifying doctor: ${error.message}`);
    }
  }

  /**
   * Buscar template por código de examen
   */
  private async findTemplateByExamCode(
    examCode: string,
    commerceId?: string
  ): Promise<ExamResultTemplate | null> {
    const query = this.templateRepository
      .whereEqualTo('examCode', examCode)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true);

    if (commerceId) {
      // Buscar primero específico del comercio
      const commerceTemplate = await query.whereEqualTo('commerceId', commerceId).find();

      if (commerceTemplate.length > 0) {
        return commerceTemplate[0];
      }
    }

    // Buscar global (sin commerceId)
    const globalTemplates = await query.whereEqualTo('commerceId', null).find();

    return globalTemplates.length > 0 ? globalTemplates[0] : null;
  }

  /**
   * Comparar con resultado anterior (método público)
   */
  async compareWithPreviousResult(
    examOrderId: string,
    currentResultId: string
  ): Promise<{ comparison: string; variations: Array<{ parameter: string; variation: number }> }> {
    const examOrder = await this.examOrderService.getExamOrderById(examOrderId);

    if (!examOrder.results || examOrder.results.length < 2) {
      return { comparison: 'No hay resultados anteriores para comparar', variations: [] };
    }

    const currentResult = examOrder.results.find(r => r.id === currentResultId);
    const previousResult = examOrder.results
      .filter(r => r.id !== currentResultId)
      .sort((a, b) => (b.resultDate?.getTime() || 0) - (a.resultDate?.getTime() || 0))[0];

    if (!currentResult || !previousResult) {
      return { comparison: 'No se encontraron resultados para comparar', variations: [] };
    }

    const comparison = this.compareWithPrevious(previousResult, currentResult);
    const variations: Array<{ parameter: string; variation: number }> = [];

    if (currentResult.values && previousResult.values) {
      const previousMap = new Map(previousResult.values.map(v => [v.parameter, v]));
      const currentMap = new Map(currentResult.values.map(v => [v.parameter, v]));

      for (const [param, currentValue] of currentMap) {
        const prevValue = previousMap.get(param);
        if (!prevValue) continue;

        const prevNum =
          typeof prevValue.value === 'number'
            ? prevValue.value
            : parseFloat(prevValue.value as string);
        const currNum =
          typeof currentValue.value === 'number'
            ? currentValue.value
            : parseFloat(currentValue.value as string);

        if (!isNaN(prevNum) && !isNaN(currNum) && prevNum !== 0) {
          const variation = ((currNum - prevNum) / prevNum) * 100;
          variations.push({ parameter: param, variation });
        }
      }
    }

    return { comparison, variations };
  }
}
