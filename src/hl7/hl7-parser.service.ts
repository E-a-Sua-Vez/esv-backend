import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

import { ORU_R01_Message, ORU_Observation, HL7Segment } from './model/hl7-message.model';

@Injectable()
export class HL7ParserService {
  /**
   * Parse raw HL7 message string into structured object
   */
  parseMessage(rawMessage: string): ORU_R01_Message {
    try {
      // Normalize line endings
      const normalized = rawMessage.replace(/\r\n/g, '\r').replace(/\n/g, '\r');

      // Split into segments
      const segmentStrings = normalized.split('\r').filter(s => s.trim().length > 0);

      const segments: HL7Segment[] = segmentStrings.map(seg => {
        const fields = seg.split('|');
        return {
          segmentType: fields[0],
          fields: fields.slice(1),
        };
      });

      // Parse MSH (Message Header)
      const msh = segments.find(s => s.segmentType === 'MSH');
      if (!msh) {
        throw new HttpException('MSH segment not found', HttpStatus.BAD_REQUEST);
      }

      const message: ORU_R01_Message = {
        segments,
        messageType: this.getField(msh, 8) || '',
        messageControlId: this.getField(msh, 9) || '',
        sendingApplication: this.getField(msh, 2),
        sendingFacility: this.getField(msh, 3),
        receivingApplication: this.getField(msh, 4),
        receivingFacility: this.getField(msh, 5),
        messageDateTime: this.parseDateTime(this.getField(msh, 6)),
        observations: [],
      };

      // Verify it's an ORU^R01 message
      if (!message.messageType.includes('ORU') || !message.messageType.includes('R01')) {
        throw new HttpException(
          `Unsupported message type: ${message.messageType}. Expected ORU^R01`,
          HttpStatus.BAD_REQUEST
        );
      }

      // Parse PID (Patient Identification)
      const pid = segments.find(s => s.segmentType === 'PID');
      if (pid) {
        message.patientId = this.getField(pid, 3);
        const patientName = this.getField(pid, 5);
        if (patientName) {
          const nameParts = patientName.split('^');
          message.patientName = `${nameParts[0] || ''} ${nameParts[1] || ''}`.trim();
        }
        message.patientBirthDate = this.parseDate(this.getField(pid, 7));
        message.patientSex = this.getField(pid, 8);
      }

      // Parse OBR (Observation Request)
      const obr = segments.find(s => s.segmentType === 'OBR');
      if (obr) {
        message.orderNumber = this.getField(obr, 2);
        message.orderDateTime = this.parseDateTime(this.getField(obr, 6));
      }

      // Parse OBX (Observation/Result)
      const obxSegments = segments.filter(s => s.segmentType === 'OBX');
      message.observations = obxSegments.map(obx => this.parseOBX(obx));

      return message;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Error parsing HL7 message: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Parse OBX segment into observation
   */
  private parseOBX(obx: HL7Segment): ORU_Observation {
    const observation: ORU_Observation = {
      observationId: this.getField(obx, 2),
      observationValue: this.getField(obx, 5),
      observationValueType: this.getField(obx, 2),
      observationUnits: this.getField(obx, 6),
      observationReferenceRange: this.getField(obx, 7),
      observationAbnormalFlags: this.getField(obx, 8),
      observationStatus: this.getField(obx, 11),
      observationDateTime: this.parseDateTime(this.getField(obx, 14)),
      observationMethod: this.getField(obx, 17),
    };

    // Parse observation name (OBX.3)
    const obsName = this.getField(obx, 3);
    if (obsName) {
      const nameParts = obsName.split('^');
      observation.observationName = nameParts[1] || nameParts[0];
      observation.observationNameCode = nameParts[0];

      // Try to extract LOINC code
      if (nameParts.length > 4) {
        observation.loincCode = nameParts[4];
      }
    }

    return observation;
  }

  /**
   * Get field value from segment (1-indexed)
   */
  private getField(segment: HL7Segment, index: number): string | undefined {
    const fieldIndex = index - 1; // Convert to 0-indexed
    if (fieldIndex < 0 || fieldIndex >= segment.fields.length) {
      return undefined;
    }
    const value = segment.fields[fieldIndex];
    return value && value.trim() !== '' ? value.trim() : undefined;
  }

  /**
   * Parse HL7 date format (YYYYMMDD)
   */
  private parseDate(dateStr?: string): Date | undefined {
    if (!dateStr || dateStr.length < 8) return undefined;

    try {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(year, month, day);
    } catch {
      return undefined;
    }
  }

  /**
   * Parse HL7 datetime format (YYYYMMDDHHMMSS)
   */
  private parseDateTime(dateTimeStr?: string): Date | undefined {
    if (!dateTimeStr) return undefined;

    // Try full datetime first
    if (dateTimeStr.length >= 14) {
      try {
        const year = parseInt(dateTimeStr.substring(0, 4));
        const month = parseInt(dateTimeStr.substring(4, 6)) - 1;
        const day = parseInt(dateTimeStr.substring(6, 8));
        const hour = parseInt(dateTimeStr.substring(8, 10)) || 0;
        const minute = parseInt(dateTimeStr.substring(10, 12)) || 0;
        const second = parseInt(dateTimeStr.substring(12, 14)) || 0;
        return new Date(year, month, day, hour, minute, second);
      } catch {
        // Fall through to date parsing
      }
    }

    // Fall back to date parsing
    return this.parseDate(dateTimeStr);
  }
}
