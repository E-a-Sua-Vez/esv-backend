import { Injectable } from '@nestjs/common';

import { ExamResult } from '../medical-exam-order/model/medical-exam-order.entity';

import { ORU_R01_Message, ORU_Observation } from './model/hl7-message.model';

@Injectable()
export class HL7MapperService {
  /**
   * Map HL7 ORU^R01 message to ExamResult format
   */
  mapToExamResult(hl7Message: ORU_R01_Message, examOrderId: string): ExamResult {
    const examResult: ExamResult = {
      id: `result-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      examId: this.extractExamId(hl7Message),
      examName: this.extractExamName(hl7Message),
      performedAt: hl7Message.orderDateTime || new Date(),
      resultDate: this.getLatestObservationDate(hl7Message.observations) || new Date(),
      values: this.mapObservationsToValues(hl7Message.observations),
      observations: this.extractObservations(hl7Message),
      status: this.determineStatus(hl7Message),
      interpretedBy: hl7Message.sendingFacility,
    };

    return examResult;
  }

  /**
   * Extract exam ID from HL7 message
   */
  private extractExamId(hl7Message: ORU_R01_Message): string {
    // Try to get from order number or first observation
    if (hl7Message.orderNumber) {
      return hl7Message.orderNumber;
    }
    if (hl7Message.observations.length > 0 && hl7Message.observations[0].observationNameCode) {
      return hl7Message.observations[0].observationNameCode;
    }
    return 'unknown';
  }

  /**
   * Extract exam name from HL7 message
   */
  private extractExamName(hl7Message: ORU_R01_Message): string {
    // Try to get from first observation name
    if (hl7Message.observations.length > 0 && hl7Message.observations[0].observationName) {
      return hl7Message.observations[0].observationName;
    }
    return 'Examen de Laboratorio';
  }

  /**
   * Map HL7 observations to ExamResult values
   */
  private mapObservationsToValues(observations: ORU_Observation[]): ExamResult['values'] {
    return observations.map(obs => {
      const value: ExamResult['values'][0] = {
        parameter: obs.observationName || obs.observationNameCode || 'Parámetro desconocido',
        value: this.parseValue(obs.observationValue),
        unit: obs.observationUnits || '',
        referenceRange: obs.observationReferenceRange,
        status: this.mapAbnormalFlag(obs.observationAbnormalFlags),
        loincCode: obs.loincCode || obs.observationNameCode,
      };

      return value;
    });
  }

  /**
   * Parse observation value to number or string
   */
  private parseValue(value?: string): string | number {
    if (!value) return '';

    // Try to parse as number
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && isFinite(numValue)) {
      return numValue;
    }

    return value;
  }

  /**
   * Map HL7 abnormal flags to our status
   */
  private mapAbnormalFlag(flags?: string): 'normal' | 'high' | 'low' | 'critical' | undefined {
    if (!flags) return 'normal';

    const flag = flags.toUpperCase();

    // HL7 abnormal flags: L (low), H (high), LL (critical low), HH (critical high), etc.
    if (flag.includes('LL') || flag.includes('HH')) {
      return 'critical';
    }
    if (flag.includes('L')) {
      return 'low';
    }
    if (flag.includes('H')) {
      return 'high';
    }

    return 'normal';
  }

  /**
   * Get latest observation date
   */
  private getLatestObservationDate(observations: ORU_Observation[]): Date | undefined {
    if (observations.length === 0) return undefined;

    const dates = observations
      .map(obs => obs.observationDateTime)
      .filter((date): date is Date => date !== undefined);

    if (dates.length === 0) return undefined;

    return new Date(Math.max(...dates.map(d => d.getTime())));
  }

  /**
   * Extract general observations/comments
   */
  private extractObservations(hl7Message: ORU_R01_Message): string | undefined {
    // Could extract from NTE segments or other comment fields
    // For now, return undefined
    return undefined;
  }

  /**
   * Determine result status from HL7 message
   */
  private determineStatus(hl7Message: ORU_R01_Message): 'preliminary' | 'final' | 'corrected' {
    // Check observation status
    const statuses = hl7Message.observations
      .map(obs => obs.observationStatus)
      .filter((s): s is string => s !== undefined);

    if (statuses.some(s => s.includes('C') || s.includes('CORRECTED'))) {
      return 'corrected';
    }

    if (statuses.some(s => s.includes('P') || s.includes('PRELIMINARY'))) {
      return 'preliminary';
    }

    return 'final';
  }
}
