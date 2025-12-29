import { Collection } from 'fireorm';

/**
 * Template de PDF para documentos médicos
 * Permite personalizar header, footer y contenido de recetas, órdenes y referencias
 */
/**
 * Elemento del canvas para templates PDF
 */
export class PdfTemplateElement {
  id: string;
  type: 'text' | 'image' | 'logo' | 'signature' | 'qrcode';
  x: number; // Posición X en puntos (A4: 595 puntos de ancho)
  y: number; // Posición Y en puntos (A4: 842 puntos de alto)
  width?: number;
  height?: number;
  // Propiedades específicas por tipo
  text?: string; // Para tipo 'text'
  fontSize?: number; // Para tipo 'text'
  color?: string; // Para tipo 'text'
  align?: 'left' | 'center' | 'right'; // Para tipo 'text'
  fontFamily?: string; // Para tipo 'text'
  src?: string; // Para tipo 'image', 'logo', 'signature' (URL o base64)
  data?: string; // Para tipo 'qrcode' (puede contener variables como {{verificationUrl}})
}

export class PdfTemplateSection {
  type: 'header' | 'footer' | 'content';
  enabled: boolean;
  html?: string; // HTML personalizado para la sección (legacy)
  text?: string; // Texto simple (alternativa a HTML, legacy)
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  fontSize?: number; // Legacy - usar elementos canvas
  fontFamily?: string; // Legacy - usar elementos canvas
  color?: string; // Legacy - usar elementos canvas
  alignment?: 'left' | 'center' | 'right'; // Legacy - usar elementos canvas
  margin?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  // Elementos del canvas (WYSIWYG)
  elements?: PdfTemplateElement[]; // Array de elementos renderizables
  // Flags de inclusión automática (para compatibilidad y facilidad)
  includeLogo?: boolean; // Incluir logo del commerce automáticamente
  includeCommerceInfo?: boolean; // Incluir info del commerce (nombre, dirección, teléfono)
  includeDoctorInfo?: boolean; // Incluir info del médico
  includeDate?: boolean; // Incluir fecha
  includeQrCode?: boolean; // Incluir QR code (solo en footer)
  includeDigitalSignature?: boolean; // Incluir firma digital (solo en footer)
}

@Collection('pdf-template')
export class PdfTemplate {
  id: string;
  name: string;
  description?: string;
  documentType: 'prescription' | 'exam_order' | 'reference';
  commerceId?: string; // Si es null, es template global
  scope: 'GLOBAL' | 'COMMERCE' | 'PERSONAL';
  active: boolean;
  available: boolean;

  // Secciones del template
  header?: PdfTemplateSection;
  footer?: PdfTemplateSection;
  content?: PdfTemplateSection;

  // Variables disponibles para el template
  variables?: string[]; // Lista de variables que se pueden usar

  // Configuración de contenido dinámico (para hacer contenido 100% configurable)
  dynamicContent?: {
    // Configuración de información del paciente
    patientInfo?: {
      enabled?: boolean; // Si false, no muestra información del paciente
      showName?: boolean;
      showId?: boolean;
      labelFontSize?: number;
      valueFontSize?: number;
      spacing?: number;
    };
    // Configuración de información del médico
    doctorInfo?: {
      enabled?: boolean;
      showName?: boolean;
      showLicense?: boolean;
      labelFontSize?: number;
      valueFontSize?: number;
      spacing?: number;
    };
    // Configuración de fecha
    dateInfo?: {
      enabled?: boolean;
      label?: string; // Ej: 'FECHA:', 'Fecha de emisión:', etc.
      format?: string; // Ej: 'pt-BR', 'en-US', etc.
      fontSize?: number;
    };
    // Configuración de medicamentos (solo para prescriptions)
    medications?: {
      enabled?: boolean;
      showTitle?: boolean;
      showName?: boolean;
      showCommercialName?: boolean;
      showDosage?: boolean;
      showFrequency?: boolean;
      showDuration?: boolean;
      showQuantity?: boolean;
      showRoute?: boolean;
      showInstructions?: boolean;
      showRefills?: boolean;
      titleFontSize?: number;
      titleFontFamily?: string;
      itemFontSize?: number;
      detailFontSize?: number;
    };
    // Configuración de instrucciones generales (solo para prescriptions)
    instructions?: {
      enabled?: boolean;
      showTitle?: boolean;
      titleFontSize?: number;
      titleFontFamily?: string;
      contentFontSize?: number;
    };
    // Configuración de observaciones (solo para prescriptions)
    observations?: {
      enabled?: boolean;
      showTitle?: boolean;
      titleFontSize?: number;
      titleFontFamily?: string;
      contentFontSize?: number;
    };
    // Configuración de validez (solo para prescriptions)
    validity?: {
      enabled?: boolean;
      label?: string; // Ej: 'Válida hasta:', 'Válido hasta:', etc.
      fontSize?: number;
    };
    // Configuración de exámenes (solo para exam_orders)
    exams?: {
      enabled?: boolean;
      showTitle?: boolean;
      showName?: boolean;
      showCode?: boolean;
      showPreparation?: boolean;
      showInstructions?: boolean;
      titleFontSize?: number;
      titleFontFamily?: string;
      itemFontSize?: number;
      detailFontSize?: number;
    };
    // Configuración de justificación clínica (solo para exam_orders)
    clinicalJustification?: {
      enabled?: boolean;
      showTitle?: boolean;
      titleFontSize?: number;
      titleFontFamily?: string;
      contentFontSize?: number;
    };
    // Configuración de secciones de referencia (solo para references)
    referenceSections?: {
      showReason?: boolean;
      showPresumptiveDiagnosis?: boolean;
      showStudiesPerformed?: boolean;
      showCurrentTreatment?: boolean;
      showReturnReport?: boolean;
      sectionTitleFontSize?: number;
      sectionTitleFontFamily?: string;
      sectionContentFontSize?: number;
      sectionContentFontFamily?: string;
    };
  };

  // Configuración adicional
  pageSize?: 'A4' | 'LETTER' | 'A5' | 'LETTER_HALF';
  margins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  orientation?: 'portrait' | 'landscape';

  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
  usageCount?: number; // Contador de uso
  isDefault?: boolean; // Template por defecto
}


