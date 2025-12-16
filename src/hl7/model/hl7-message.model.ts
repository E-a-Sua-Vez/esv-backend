/**
 * HL7 Message Structure
 * Based on HL7 v2.5 standard
 */

export interface HL7Segment {
  segmentType: string;
  fields: string[];
}

export interface HL7Message {
  segments: HL7Segment[];
  messageType: string;
  messageControlId: string;
  sendingApplication?: string;
  sendingFacility?: string;
  receivingApplication?: string;
  receivingFacility?: string;
  messageDateTime?: Date;
}

/**
 * ORU^R01 - Observation Result Message
 * Used for laboratory results
 */
export interface ORU_R01_Message extends HL7Message {
  patientId?: string;
  patientName?: string;
  patientBirthDate?: Date;
  patientSex?: string;
  orderNumber?: string;
  orderDateTime?: Date;
  observations: ORU_Observation[];
}

export interface ORU_Observation {
  observationId?: string;
  observationValue?: string;
  observationValueType?: string;
  observationUnits?: string;
  observationReferenceRange?: string;
  observationAbnormalFlags?: string;
  observationStatus?: string;
  observationDateTime?: Date;
  observationMethod?: string;
  observationName?: string;
  observationNameCode?: string;
  loincCode?: string;
  performingOrganizationName?: string;
  performingOrganizationAddress?: string;
}
