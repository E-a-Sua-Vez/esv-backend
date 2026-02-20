import { Readable } from 'stream';

import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as AWS from 'aws-sdk';
const PDFDocument = require('pdfkit');
import * as QRCode from 'qrcode';
import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';

import { Prescription, MedicationItem } from './model/prescription.entity';
import { CollaboratorService } from '../collaborator/collaborator.service';
import { ProfessionalService } from '../professional/professional.service';

@Injectable()
export class PrescriptionPdfService {
  private s3: AWS.S3;
  private readonly logger = new Logger(PrescriptionPdfService.name);

  constructor(
    private collaboratorService: CollaboratorService,
    private professionalService: ProfessionalService
  ) {
    this.s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      region: process.env.AWS_DEFAULT_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
  }

  /**
   * Obtener variables médicas extendidas de un profesional o colaborador (fallback)
   */
  private async getDoctorVariables(
    professionalId?: string,
    collaboratorId?: string
  ): Promise<{
    doctorName?: string;
    doctorTitle?: string;
    doctorLicense?: string;
    doctorSpecialization?: string;
    doctorClinicName?: string;
    doctorClinicAddress?: string;
    doctorProfessionalPhone?: string;
    doctorProfessionalEmail?: string;
    doctorSignature?: string;
  }> {
    try {
      // PRIORIDAD 1: Usar professionalId si existe
      if (professionalId) {
        const professional = await this.professionalService.getProfessionalForMedicalDocuments(professionalId);

        return {
          doctorName: professional.name || '',
          doctorTitle: professional.professionalTitle || 'Dr.',
          doctorLicense: professional.crm || '',
          doctorSpecialization: professional.specialties || '',
          doctorClinicName: professional.medicalData?.clinicName || '',
          doctorClinicAddress: professional.medicalData?.clinicAddress || professional.medicalData?.professionalAddress || '',
          doctorProfessionalPhone: professional.medicalData?.professionalPhone || professional.medicalData?.clinicPhone || '',
          doctorProfessionalEmail: professional.email || '',
          doctorSignature: professional.digitalSignature || '',
        };
      }

      // FALLBACK: Usar collaboratorId si no hay professionalId (compatibilidad)
      if (collaboratorId) {
        this.logger.warn(`Using deprecated collaboratorId for medical document. Please migrate to professionalId. CollaboratorId: ${collaboratorId}`);

        const collaborator = await this.collaboratorService.getCollaboratorForMedicalDocuments(collaboratorId);

        // Verificar si tiene professional vinculado
        if (collaborator.professionalId) {
          this.logger.log(`Found professionalId ${collaborator.professionalId} linked to collaboratorId ${collaboratorId}`);
          return this.getDoctorVariables(collaborator.professionalId, undefined);
        }

        // Si no tiene professionalId vinculado, retornar datos básicos del collaborator
        return {
          doctorName: collaborator.name || '',
          doctorTitle: 'Dr.',
          doctorLicense: '',
          doctorSignature: '',
          doctorSpecialization: '',
          doctorClinicName: '',
          doctorClinicAddress: '',
          doctorProfessionalPhone: '',
          doctorProfessionalEmail: '',
        };
      }

      return {};
    } catch (error) {
      this.logger.error(`Could not fetch doctor data: ${error.message}`);
      return {};
    }
  }

  /**
   * Reemplazar variables en texto (ej: {{verificationUrl}}, {{patientName}}, etc.)
   * EXTENDIDO: Ahora incluye variables de datos médicos del colaborador
   */
  private replaceVariables(
    text: string,
    variables: {
      verificationUrl?: string;
      patientName?: string;
      patientIdNumber?: string;
      commerceName?: string;
      commerceAddress?: string;
      commercePhone?: string;
      doctorName?: string;
      doctorLicense?: string;
      doctorSpecialization?: string;
      doctorClinicName?: string;
      doctorClinicAddress?: string;
      doctorProfessionalPhone?: string;
      doctorProfessionalEmail?: string;
      doctorTitle?: string;
      date?: string;
      [key: string]: any;
    }
  ): string {
    if (!text) return text;
    let result = text;
    Object.keys(variables).forEach((key) => {
      const value = variables[key];
      if (value !== undefined && value !== null) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
    });
    return result;
  }

  /**
   * Renderizar elementos del canvas en el PDF
   */
  private async renderCanvasElements(
    doc: any, // PDFDocument from pdfkit
    elements: any[],
    variables: {
      verificationUrl?: string;
      patientName?: string;
      patientIdNumber?: string;
      commerceName?: string;
      commerceAddress?: string;
      commercePhone?: string;
      doctorName?: string;
      doctorLicense?: string;
      date?: string;
      commerceLogo?: string;
      doctorSignature?: string;
      [key: string]: any;
    },
    yOffset: number = 0 // Offset Y inicial para posicionar la sección
  ): Promise<void> {
    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      return;
    }

    // Validar número máximo de elementos (50 por sección)
    const MAX_ELEMENTS = 50;
    if (elements.length > MAX_ELEMENTS) {
      this.logger.warn(`Too many elements (${elements.length}), limiting to ${MAX_ELEMENTS}`);
      elements = elements.slice(0, MAX_ELEMENTS);
    }

    // Ordenar elementos por posición Y (de arriba hacia abajo)
    const sortedElements = [...elements].sort((a, b) => (a.y || 0) - (b.y || 0));

    for (const element of sortedElements) {
      try {
        const x = element.x || 0;
        const y = (element.y || 0) + yOffset; // Aplicar offset Y
        const width = element.width;
        const height = element.height;

        switch (element.type) {
          case 'text':
            {
              // Sanitizar texto antes de renderizar
              const rawText = element.text || '';
              const sanitizedText = this.sanitizeText(rawText);
              const text = this.replaceVariables(sanitizedText, variables);
              const fontSize = element.fontSize || 12;
              const color = element.color || '#000000';
              const align = element.align || 'left';

              // Seleccionar fuente según estilos
              let fontFamily = 'Helvetica';
              if (element.bold && element.italic) fontFamily = 'Helvetica-BoldOblique';
              else if (element.bold) fontFamily = 'Helvetica-Bold';
              else if (element.italic) fontFamily = 'Helvetica-Oblique';

              doc.fontSize(fontSize)
                .font(fontFamily)
                .fillColor(color);

              // Aplicar prefijo según tipo de lista
              let displayText = text;
              if (element.listType === 'bullet') displayText = '• ' + text;
              else if (element.listType === 'dot') displayText = '∘ ' + text;
              else if (element.listType === 'number') displayText = '1. ' + text;

              // PDFKit maneja la alineación automáticamente con las opciones
              doc.text(displayText, x, y, {
                width: width || 100,
                align: align,
                lineBreak: false,
              });

              // Dibujar subrayado si está activo
              if (element.underline) {
                const textWidth = doc.widthOfString(displayText);
                const textY = y + fontSize + 2;

                let underlineX = x;
                if (align === 'center') {
                  underlineX = x + (width / 2) - (textWidth / 2);
                } else if (align === 'right') {
                  underlineX = x + width - textWidth;
                }

                doc.moveTo(underlineX, textY)
                  .lineTo(underlineX + textWidth, textY)
                  .stroke();
              }
            }
            break;

          case 'image':
            {
              if (element.src) {
                const imageBuffer = await this.loadImageFromUrl(element.src);
                if (imageBuffer) {
                  doc.image(imageBuffer, x, y, {
                    width: width || 200,
                    height: height || 200,
                    fit: [width || 200, height || 200],
                  });
                }
              }
            }
            break;

          case 'logo':
            {
              const logoUrl = variables.commerceLogo || element.src;
              if (logoUrl) {
                const logoBuffer = await this.loadImageFromUrl(logoUrl);
                if (logoBuffer) {
                  doc.image(logoBuffer, x, y, {
                    width: width || 80,
                    height: height || 80,
                    fit: [width || 80, height || 80],
                  });
                }
              }
            }
            break;

          case 'signature':
            {
              const signatureUrl = variables.doctorSignature || element.src;
              if (signatureUrl) {
                const signatureBuffer = await this.loadImageFromUrl(signatureUrl);
                if (signatureBuffer) {
                  doc.image(signatureBuffer, x, y, {
                    width: width || 60,
                    height: height || 20,
                    fit: [width || 60, height || 20],
                  });
                }
              }
            }
            break;

          case 'qrcode':
            {
              const qrData = this.replaceVariables(
                element.data || '{{verificationUrl}}',
                variables
              );
              if (qrData && qrData !== '{{verificationUrl}}') {
                try {
                  const QRCode = require('qrcode');
                  const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
                    errorCorrectionLevel: 'H',
                    width: width || 100,
                  });
                  const qrImageBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
                  doc.image(qrImageBuffer, x, y, {
                    width: width || 100,
                    height: height || 100,
                  });
                } catch (error) {
                  this.logger.warn(`Error generating QR code: ${error.message}`);
                }
              }
            }
            break;

          case 'line':
            {
              const lineWidth = element.lineWidth || 2;
              const lineStyle = element.lineStyle || 'solid';
              const color = element.color || '#000000';

              doc.lineWidth(lineWidth).strokeColor(color);

              // Aplicar estilo de línea
              if (lineStyle === 'dashed') {
                doc.dash(5, { space: 5 });
              } else if (lineStyle === 'double') {
                // Dibujar primera línea
                doc.moveTo(x, y).lineTo(x + (width || 100), y).stroke();
                // Dibujar segunda línea
                doc.moveTo(x, y + 3).lineTo(x + (width || 100), y + 3).stroke();
              } else {
                doc.undash();
              }

              // Dibujar línea principal
              doc.moveTo(x, y).lineTo(x + (width || 100), y).stroke();
              doc.undash(); // Resetear el estilo de línea
            }
            break;

          default:
            this.logger.warn(`Unknown element type: ${element.type}`);
        }
      } catch (error) {
        this.logger.error(`Error rendering element ${element.id}: ${error.message}`, error.stack);
      }
    }
  }

  /**
   * Validar tamaño de imagen (máximo 5MB)
   */
  private validateImageSize(buffer: Buffer): boolean {
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (buffer.length > maxSize) {
      this.logger.warn(`Image size ${buffer.length} exceeds maximum ${maxSize}`);
      return false;
    }
    return true;
  }

  /**
   * Sanitizar texto para prevenir XSS
   */
  private sanitizeText(text: string): string {
    if (!text) return text;
    // Remover caracteres peligrosos pero mantener variables {{}}
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * Cargar imagen desde URL o base64 con validaciones
   */
  private async loadImageFromUrl(urlOrBase64: string): Promise<Buffer | null> {
    try {
      let buffer: Buffer | null = null;

      // Si es base64
      if (urlOrBase64.startsWith('data:image')) {
        const base64Data = urlOrBase64.split(',')[1];
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        // Si es URL
        buffer = await new Promise<Buffer | null>((resolve, reject) => {
          const protocol = urlOrBase64.startsWith('https') ? https : http;
          const timeout = 10000; // 10 segundos timeout

          const request = protocol.get(urlOrBase64, (response) => {
            if (response.statusCode !== 200) {
              reject(new Error(`Failed to load image: ${response.statusCode}`));
              return;
            }

            const chunks: Buffer[] = [];
            response.on('data', (chunk) => {
              chunks.push(chunk);
              // Validar tamaño mientras se descarga
              const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
              if (totalSize > 5 * 1024 * 1024) {
                // 5MB
                response.destroy();
                reject(new Error('Image size exceeds 5MB limit'));
                return;
              }
            });
            response.on('end', () => resolve(Buffer.concat(chunks as Uint8Array[])));
            response.on('error', reject);
          });

          request.setTimeout(timeout, () => {
            request.destroy();
            reject(new Error('Image load timeout'));
          });

          request.on('error', reject);
        });
      }

      // Validar tamaño final
      if (buffer && !this.validateImageSize(buffer)) {
        return null;
      }

      return buffer;
    } catch (error) {
      this.logger.error(`Error loading image: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Obtener altura de página según tamaño
   */
  private getPageHeight(pageSize: string): number {
    const sizes = {
      'A4': 842,
      'LETTER': 792,
      'A5': 595,
      'LETTER_HALF': 612
    };
    return sizes[pageSize] || 842;
  }

  /**
   * Calcular alturas de secciones del template
   */
  private calculateSectionHeights(template: any): {
    headerHeight: number;
    footerHeight: number;
    contentAreaHeight: number;
  } {
    const pageHeight = this.getPageHeight(template?.pageSize || 'A4');
    const margins = template?.margins || { top: 50, bottom: 50, left: 50, right: 50 };

    // Calcular altura del header
    let headerHeight = 0;
    if (template?.header?.elements && Array.isArray(template.header.elements) && template.header.elements.length > 0) {
      const maxHeaderY = Math.max(
        ...template.header.elements.map((e: any) => (e.y || 0) + (e.height || 0))
      );
      headerHeight = maxHeaderY + 20; // Padding de 20pt después del header
    } else {
      headerHeight = 100; // Default header height
    }

    // Calcular altura del footer - medir desde el elemento más arriba hasta el más abajo
    let footerHeight = 0;
    if (template?.footer?.elements && Array.isArray(template.footer.elements) && template.footer.elements.length > 0) {
      const minFooterY = Math.min(
        ...template.footer.elements.map((e: any) => e.y || 0)
      );
      const maxFooterY = Math.max(
        ...template.footer.elements.map((e: any) => (e.y || 0) + (e.height || 0))
      );
      // Altura real del footer = desde el primer elemento hasta el último + padding
      footerHeight = (maxFooterY - minFooterY) + 30; // 30pt de padding total
    } else {
      footerHeight = 80; // Default footer height
    }

    // Área de contenido disponible
    const contentAreaHeight = pageHeight - margins.top - margins.bottom - headerHeight - footerHeight;

    return { headerHeight, footerHeight, contentAreaHeight };
  }

  /**
   * Renderizar header en la página actual
   */
  private async renderHeaderOnCurrentPage(
    doc: any,
    template: any,
    variables: Record<string, any>,
    commerceLogo?: string,
    commerceName?: string,
    commerceAddress?: string,
    commercePhone?: string
  ): Promise<void> {
    const headerSection = template?.header;

    if (headerSection?.elements && Array.isArray(headerSection.elements) && headerSection.elements.length > 0) {
      // Renderizar elementos del canvas
      await this.renderCanvasElements(doc, headerSection.elements, variables, 0);
    } else if (headerSection?.enabled) {
      // Modo legacy: usar flags y texto simple
      if (headerSection.includeLogo && commerceLogo) {
        try {
          const logoBuffer = await this.loadImageFromUrl(commerceLogo);
          if (logoBuffer) {
            const logoSize = 40;
            const logoX = (doc.page.width - logoSize) / 2;
            doc.image(logoBuffer, logoX, doc.y, {
              width: logoSize,
              height: logoSize,
            });
            doc.moveDown(2);
          }
        } catch (error) {
          this.logger.warn(`Could not load commerce logo in header: ${error.message}`);
        }
      }

      if (headerSection.includeCommerceInfo) {
        if (commerceName) {
          doc.fontSize(12).font('Helvetica-Bold').text(commerceName, { align: 'center' });
        }
        if (commerceAddress) {
          doc.fontSize(10).font('Helvetica').text(commerceAddress, { align: 'center' });
        }
        if (commercePhone) {
          doc.fontSize(10).font('Helvetica').text(commercePhone, { align: 'center' });
        }
        doc.moveDown(1);
      }

      if (headerSection.text) {
        const text = this.replaceVariables(headerSection.text, variables);
        doc.fontSize(headerSection.fontSize || 14)
          .font(headerSection.fontFamily || 'Helvetica-Bold')
          .fillColor(headerSection.color || '#000000')
          .text(text, {
            align: headerSection.alignment || 'center',
          });
        doc.moveDown(0.5);
      }
    } else {
      // Header por defecto
      doc.fontSize(20).font('Helvetica-Bold').text('RECETA MÉDICA', { align: 'center' });
      doc.moveDown(1);

      if (commerceName) {
        doc.fontSize(12).font('Helvetica-Bold').text(commerceName, { align: 'center' });
      }
      if (commerceAddress) {
        doc.fontSize(10).font('Helvetica').text(commerceAddress, { align: 'center' });
      }
      doc.moveDown(1);
    }
  }

  /**
   * Renderizar footer en la página actual
   */
  private async renderFooterOnCurrentPage(
    doc: any,
    template: any,
    variables: Record<string, any>,
    pageHeight: number,
    prescription: Prescription,
    doctorSignature?: string,
    qrCodeDataUrl?: string
  ): Promise<void> {
    // Guardar posición actual
    const savedY = doc.y;
    const footerSection = template?.footer;
    const hasCanvasFooter = footerSection?.elements && Array.isArray(footerSection.elements) && footerSection.elements.length > 0;

    if (hasCanvasFooter) {
      // Calcular el offset Y para posicionar el footer al final de la página
      const margins = template?.margins || { top: 50, bottom: 50, left: 50, right: 50 };

      // Calcular la altura real del footer (desde el primer hasta el último elemento)
      const minFooterY = Math.min(
        ...footerSection.elements.map((e: any) => e.y || 0)
      );
      const maxFooterY = Math.max(
        ...footerSection.elements.map((e: any) => (e.y || 0) + (e.height || 0))
      );
      const footerHeight = maxFooterY - minFooterY;

      // Calcular donde debe empezar el footer en esta página
      // Debe estar al final: pageHeight - margen inferior - altura del footer
      const footerStartY = pageHeight - margins.bottom - footerHeight - 10; // 10pt de padding

      // El offset es la diferencia entre donde queremos que esté y donde está diseñado
      const yOffset = footerStartY - minFooterY;

      // Renderizar elementos del canvas con el offset correcto
      await this.renderCanvasElements(doc, footerSection.elements, variables, yOffset);
    } else if (footerSection?.enabled) {
      // Modo legacy: posicionar footer al final de la página
      const margins = template?.margins || { top: 50, bottom: 50, left: 50, right: 50 };
      const footerY = pageHeight - margins.bottom - 80;
      doc.y = footerY;

      if (footerSection.includeDigitalSignature && doctorSignature) {
        try {
          const signatureBuffer = await this.loadImageFromUrl(doctorSignature);
          if (signatureBuffer) {
            const signatureSize = 60;
            const signatureX = (doc.page.width - signatureSize) / 2;
            doc.image(signatureBuffer, signatureX, doc.y, {
              width: signatureSize,
              height: signatureSize * 0.3,
            });
            doc.moveDown(0.3);
          }
        } catch (error) {
          this.logger.warn(`Could not load digital signature in footer: ${error.message}`);
          doc.fontSize(10).font('Helvetica').text('_________________________', {
            align: 'center',
          });
        }
      } else {
        doc.fontSize(10).font('Helvetica').text('_________________________', {
          align: 'center',
        });
      }

      if (footerSection.includeDoctorInfo) {
        doc.fontSize(10).font('Helvetica-Bold').text(prescription.doctorName, {
          align: 'center',
        });
        if (prescription.doctorLicense) {
          doc.fontSize(9).font('Helvetica').text(`CRM: ${prescription.doctorLicense}`, {
            align: 'center',
          });
        }
      }

      if (footerSection.text) {
        const text = this.replaceVariables(footerSection.text, variables);
        doc.fontSize(footerSection.fontSize || 8)
          .font(footerSection.fontFamily || 'Helvetica')
          .fillColor(footerSection.color || '#666666')
          .text(text, {
            align: footerSection.alignment || 'center',
          });
      }
    } else {
      // Footer por defecto al final de la página
      const margins = template?.margins || { top: 50, bottom: 50, left: 50, right: 50 };
      const footerY = pageHeight - margins.bottom - 80;
      doc.y = footerY;

      if (doctorSignature) {
        try {
          const signatureBuffer = await this.loadImageFromUrl(doctorSignature);
          if (signatureBuffer) {
            const signatureSize = 60;
            const signatureX = (doc.page.width - signatureSize) / 2;
            doc.image(signatureBuffer, signatureX, doc.y, {
              width: signatureSize,
              height: signatureSize * 0.3,
            });
            doc.moveDown(0.3);
          }
        } catch (error) {
          this.logger.warn(`Could not load digital signature: ${error.message}`);
          doc.fontSize(10).font('Helvetica').text('_________________________', {
            align: 'center',
          });
        }
      } else {
        doc.fontSize(10).font('Helvetica').text('_________________________', {
          align: 'center',
        });
      }

      doc.fontSize(10).font('Helvetica-Bold').text(prescription.doctorName, { align: 'center' });
      if (prescription.doctorLicense) {
        doc.fontSize(9).font('Helvetica').text(`CRM: ${prescription.doctorLicense}`, {
          align: 'center',
        });
      }

      // Agregar QR code si está disponible
      if (qrCodeDataUrl && !hasCanvasFooter) {
        const qrImageBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
        const qrSize = 60;
        const qrX = doc.page.width - margins.right - qrSize - 10;
        const qrY = pageHeight - margins.bottom - qrSize - 10;

        doc.image(qrImageBuffer, qrX, qrY, {
          width: qrSize,
          height: qrSize,
        });

        doc
          .fontSize(7)
          .font('Helvetica')
          .text('Código QR para verificación', qrX - 10, qrY + qrSize + 2, {
            width: qrSize + 20,
            align: 'center',
          });
      }
    }

    // Restaurar posición
    doc.y = savedY;
  }

  /**
   * Calcular altura aproximada de un bloque de texto
   */
  private calculateTextHeight(doc: any, text: string, fontSize: number, options: any = {}): number {
    if (!text) return 0;

    // Guardar configuración actual
    const currentFontSize = doc._fontSize;
    const currentFont = doc._font;

    // Aplicar la fuente para calcular
    doc.fontSize(fontSize);
    if (options.font) {
      doc.font(options.font);
    }

    const width = options.width || (doc.page.width - doc.page.margins.left - doc.page.margins.right - 40);
    const height = doc.heightOfString(text, { ...options, width });

    // Restaurar configuración original
    doc.fontSize(currentFontSize);
    doc.font(currentFont);

    // Agregar un margen de seguridad del 20%
    return Math.ceil(height * 1.2);
  }

  /**
   * Verificar si necesitamos nueva página y agregarla si es necesario
   */
  private async checkAndAddNewPageIfNeeded(
    doc: any,
    requiredHeight: number,
    template: any,
    variables: Record<string, any>,
    heights: { headerHeight: number; footerHeight: number; contentAreaHeight: number },
    prescription: Prescription,
    commerceName?: string,
    commerceAddress?: string,
    commercePhone?: string,
    commerceLogo?: string,
    doctorSignature?: string,
    qrCodeDataUrl?: string
  ): Promise<boolean> {
    const pageHeight = this.getPageHeight(template?.pageSize || 'A4');
    const margins = template?.margins || { top: 50, bottom: 50, left: 50, right: 50 };

    // Calcular donde debe empezar el footer usando la misma lógica que renderFooterOnCurrentPage
    let footerStartY;
    const footerSection = template?.footer;
    const hasCanvasFooter = footerSection?.elements && Array.isArray(footerSection.elements) && footerSection.elements.length > 0;

    if (hasCanvasFooter) {
      // Calcular altura real del footer
      const minFooterY = Math.min(
        ...footerSection.elements.map((e: any) => e.y || 0)
      );
      const maxFooterY = Math.max(
        ...footerSection.elements.map((e: any) => (e.y || 0) + (e.height || 0))
      );
      const footerHeight = maxFooterY - minFooterY;
      // Footer debe empezar en: pageHeight - margen inferior - altura del footer - padding
      footerStartY = pageHeight - margins.bottom - footerHeight - 10;
    } else {
      // Usar altura calculada previamente para footers legacy
      footerStartY = pageHeight - margins.bottom - heights.footerHeight;
    }

    // Verificar si hay espacio suficiente
    const availableSpace = footerStartY - doc.y;

    // Log para debug
    this.logger.debug(`CheckPage: currentY=${doc.y}, footerStartY=${footerStartY}, availableSpace=${availableSpace}, requiredHeight=${requiredHeight}`);

    if (requiredHeight > availableSpace) {
      this.logger.debug(`Adding new page - not enough space`);
      // Renderizar footer en página actual
      await this.renderFooterOnCurrentPage(doc, template, variables, pageHeight, prescription, doctorSignature, qrCodeDataUrl);

      // Agregar nueva página
      let docSize: any = template?.pageSize || 'A4';
      if (docSize === 'LETTER_HALF') {
        docSize = [396, 612];
      }

      doc.addPage({
        size: docSize,
        margins: margins,
        layout: template?.orientation || 'portrait'
      });

      // Renderizar header en nueva página
      await this.renderHeaderOnCurrentPage(doc, template, variables, commerceLogo, commerceName, commerceAddress, commercePhone);

      // Posicionar cursor después del header
      doc.y = margins.top + heights.headerHeight;

      return true; // Se agregó nueva página
    }

    return false; // No se necesitó nueva página
  }

  /**
   * Generar PDF de receta médica
   */
  async generatePrescriptionPdf(
    prescription: Prescription,
    patientName: string,
    patientIdNumber: string,
    commerceName: string,
    commerceAddress?: string,
    commercePhone?: string,
    commerceLogo?: string, // URL del logo del commerce
    doctorSignature?: string, // URL o base64 de la firma digital del médico
    template?: any // PdfTemplate opcional
  ): Promise<{ pdfUrl: string; qrCode: string; verificationUrl: string }> {
    try {
      // Crear documento PDF
      const pageSize = template?.pageSize || 'A4';
      const margins = template?.margins || { top: 50, bottom: 50, left: 50, right: 50 };
      const orientation = template?.orientation || 'portrait';

      // Map custom sizes (like half Letter) to explicit dimensions; PDFKit supports 'A5' natively
      let docSize: any = pageSize;
      if (pageSize === 'LETTER_HALF') {
        // Half Letter portrait: 5.5in x 8.5in = 396 x 612 pts
        docSize = [396, 612];
      }

      const doc = new PDFDocument({
        size: docSize,
        margins,
        layout: orientation,
      });

      // Generar URL de verificación pública
      const baseUrl = process.env.FRONTEND_URL || process.env.BACKEND_URL || 'https://estuturno.app';
      const verificationUrl = `${baseUrl}/verify/prescription/${prescription.id}`;

      // Generar código QR con URL de verificación (siguiendo estándar ISO/IEC 20248)
      const qrData = verificationUrl; // QR apunta directamente a la URL de verificación
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        width: 200,
      });

      // Obtener variables médicas extendidas del profesional o colaborador (fallback)
      const extendedDoctorVariables = await this.getDoctorVariables(
        prescription.professionalId,
        prescription.collaboratorId // fallback
      );

      // Variables disponibles para templates (EXTENDIDAS con datos médicos)
      const templateVariables = {
        verificationUrl,
        patientName,
        patientIdNumber,
        commerceName,
        commerceAddress,
        commercePhone,
        doctorName: prescription.doctorName,
        doctorLicense: prescription.doctorLicense,
        date: new Date(prescription.date).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        commerceLogo,
        doctorSignature,
        // Variables médicas extendidas
        ...extendedDoctorVariables,
      };

      // Calcular alturas de las secciones para paginación
      const heights = this.calculateSectionHeights(template);
      const pageHeight = this.getPageHeight(pageSize);

      // HEADER - Renderizar en primera página
      await this.renderHeaderOnCurrentPage(doc, template, templateVariables, commerceLogo, commerceName, commerceAddress, commercePhone);

      // Posicionar cursor después del header
      doc.y = margins.top + heights.headerHeight;

      // CONTENT - Usar template si existe, sino usar default
      const contentSection = template?.content;
      const hasCanvasContent = contentSection?.elements && Array.isArray(contentSection.elements) && contentSection.elements.length > 0;

      // Si hay elementos del canvas, renderizarlos (independientemente de enabled)
      if (hasCanvasContent) {
        // Content: Las coordenadas Y del canvas (0-842 para A4) ya son absolutas en la página
        // NO se debe agregar ningún offset adicional
        await this.renderCanvasElements(doc, contentSection.elements, templateVariables, 0);
        // Calcular altura máxima del content
        const maxContentY = Math.max(...contentSection.elements.map((e: any) => (e.y || 0) + (e.height || 0)));
        doc.y = maxContentY + 20; // Espacio después del content
        // Si hay elementos del canvas, NO agregar contenido hardcoded adicional
        // El usuario tiene control total del diseño
      } else if (contentSection?.enabled && contentSection.text) {
        // Modo legacy: usar texto simple
        const text = this.replaceVariables(contentSection.text, templateVariables);
        doc.fontSize(contentSection.fontSize || 12)
          .font(contentSection.fontFamily || 'Helvetica')
          .fillColor(contentSection.color || '#000000')
          .text(text, {
            align: contentSection.alignment || 'left',
            indent: contentSection.margin?.left || 0,
          });
        doc.moveDown(1);
      }

      // Solo agregar contenido hardcoded si NO hay elementos del canvas en content
      if (!hasCanvasContent) {
        // Verificar espacio para línea separadora
        await this.checkAndAddNewPageIfNeeded(doc, 30, template, templateVariables, heights, prescription, commerceName, commerceAddress, commercePhone, commerceLogo, doctorSignature, qrCodeDataUrl);

        // Línea separadora
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(1);

      // Información del paciente - Configurable
      const patientInfo = template?.dynamicContent?.patientInfo;
      if (patientInfo?.enabled !== false) {
        // Calcular altura real necesaria
        const labelFontSize = patientInfo?.labelFontSize || 12;
        const valueFontSize = patientInfo?.valueFontSize || 11;
        let requiredHeight = 0;

        if (patientInfo?.showName !== false) {
          requiredHeight += labelFontSize + valueFontSize + 5;
        }
        if (patientInfo?.showId !== false) {
          requiredHeight += 15;
        }
        requiredHeight += 20; // Spacing

        await this.checkAndAddNewPageIfNeeded(doc, requiredHeight, template, templateVariables, heights, prescription, commerceName, commerceAddress, commercePhone, commerceLogo, doctorSignature, qrCodeDataUrl);

        const spacing = patientInfo?.spacing || 0.5;

        if (patientInfo?.showName !== false) {
          doc.fontSize(labelFontSize).font('Helvetica-Bold').text('PACIENTE:', { continued: false });
          doc.fontSize(valueFontSize).font('Helvetica').text(patientName, { indent: 20 });
        }
        if (patientInfo?.showId !== false) {
          doc.fontSize(10).font('Helvetica').text(`ID: ${patientIdNumber}`, { indent: 20 });
        }
        doc.moveDown(spacing);
      }

      // Información del médico - Configurable
      const doctorInfo = template?.dynamicContent?.doctorInfo;
      if (doctorInfo?.enabled !== false) {
        // Calcular altura real necesaria
        const labelFontSize = doctorInfo?.labelFontSize || 12;
        const valueFontSize = doctorInfo?.valueFontSize || 11;
        let requiredHeight = 0;

        if (doctorInfo?.showName !== false) {
          requiredHeight += labelFontSize + valueFontSize + 5;
        }
        if (doctorInfo?.showLicense !== false && prescription.doctorLicense) {
          requiredHeight += 15;
        }
        requiredHeight += 20; // Spacing

        await this.checkAndAddNewPageIfNeeded(doc, requiredHeight, template, templateVariables, heights, prescription, commerceName, commerceAddress, commercePhone, commerceLogo, doctorSignature, qrCodeDataUrl);

        const spacing = doctorInfo?.spacing || 0.5;

        if (doctorInfo?.showName !== false) {
          doc.fontSize(labelFontSize).font('Helvetica-Bold').text('MÉDICO:', { continued: false });
          doc.fontSize(valueFontSize).font('Helvetica').text(prescription.doctorName, { indent: 20 });
        }
        if (doctorInfo?.showLicense !== false && prescription.doctorLicense) {
          doc
            .fontSize(10)
            .font('Helvetica')
            .text(`CRM: ${prescription.doctorLicense}`, { indent: 20 });
        }
        doc.moveDown(spacing);
      }

      // Fecha - Configurable
      const dateInfo = template?.dynamicContent?.dateInfo;
      if (dateInfo?.enabled !== false) {
        // Verificar espacio para fecha (aproximadamente 60pt)
        await this.checkAndAddNewPageIfNeeded(doc, 60, template, templateVariables, heights, prescription, commerceName, commerceAddress, commercePhone, commerceLogo, doctorSignature, qrCodeDataUrl);

        const dateStr = new Date(prescription.date).toLocaleDateString(
          dateInfo?.format || 'pt-BR',
          {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }
        );
        const label = dateInfo?.label || 'FECHA:';
        doc.fontSize(dateInfo?.fontSize || 12).font('Helvetica-Bold').text(label, { continued: false });
        doc.fontSize(11).font('Helvetica').text(dateStr, { indent: 20 });
        doc.moveDown(1);
      }

      // Verificar espacio para línea separadora
      await this.checkAndAddNewPageIfNeeded(doc, 30, template, templateVariables, heights, prescription, commerceName, commerceAddress, commercePhone, commerceLogo, doctorSignature, qrCodeDataUrl);

      // Línea separadora
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // Medicamentos - Configurable
      const medicationsConfig = template?.dynamicContent?.medications;
      if (medicationsConfig?.enabled !== false && prescription.medications && prescription.medications.length > 0) {
        // Verificar espacio para título de medicamentos (aproximadamente 50pt)
        await this.checkAndAddNewPageIfNeeded(doc, 50, template, templateVariables, heights, prescription, commerceName, commerceAddress, commercePhone, commerceLogo, doctorSignature, qrCodeDataUrl);

        const title = medicationsConfig?.title || 'MEDICAMENTOS:';
        const titleFontSize = medicationsConfig?.titleFontSize || 14;
        const titleFontFamily = medicationsConfig?.titleFontFamily || 'Helvetica-Bold';
        const titleColor = medicationsConfig?.titleColor || '#000000';
        const itemFontSize = medicationsConfig?.itemFontSize || 12;
        const itemFontFamily = medicationsConfig?.itemFontFamily || 'Helvetica-Bold';
        const itemColor = medicationsConfig?.itemColor || '#000000';
        const spacing = medicationsConfig?.spacing || 0.5;

        doc.fontSize(titleFontSize)
          .font(titleFontFamily)
          .fillColor(titleColor)
          .text(title, { underline: true });
        doc.moveDown(0.5);

        for (let index = 0; index < prescription.medications.length; index++) {
          const medication = prescription.medications[index];

          // Calcular altura necesaria para este medicamento
          const itemFontSize = medicationsConfig?.itemFontSize || 12;
          let medicationHeight = itemFontSize + 15; // Nombre del medicamento + espaciado

          if (medicationsConfig?.showCommercialName !== false && medication.commercialName) {
            medicationHeight += 18;
          }
          if (medicationsConfig?.showDosage !== false) {
            medicationHeight += 18;
          }
          if (medicationsConfig?.showFrequency !== false) {
            medicationHeight += 18;
          }
          if (medicationsConfig?.showDuration !== false) {
            medicationHeight += 18;
          }
          if (medicationsConfig?.showInstructions !== false && medication.instructions) {
            medicationHeight += this.calculateTextHeight(doc, medication.instructions, 10, { indent: 20, font: 'Helvetica-Oblique' });
          }
          if (medicationsConfig?.showRefills !== false && medication.refillsAllowed > 0) {
            medicationHeight += 18;
          }
          medicationHeight += 25; // Spacing adicional entre medicamentos

          await this.checkAndAddNewPageIfNeeded(doc, medicationHeight, template, templateVariables, heights, prescription, commerceName, commerceAddress, commercePhone, commerceLogo, doctorSignature, qrCodeDataUrl);

          const medNumber = index + 1;

          // Nombre del medicamento
          if (medicationsConfig?.showNumber !== false) {
            doc.fontSize(itemFontSize)
              .font(itemFontFamily)
              .fillColor(itemColor)
              .text(`${medNumber}. ${medication.medicationName}`, {
                indent: 20,
              });
          } else {
            doc.fontSize(itemFontSize)
              .font(itemFontFamily)
              .fillColor(itemColor)
              .text(medication.medicationName, {
                indent: 20,
              });
          }

          if (medicationsConfig?.showCommercialName !== false && medication.commercialName) {
            doc.fontSize(10).font('Helvetica-Oblique').text(`   (${medication.commercialName})`, {
              indent: 20,
            });
          }

          // Detalles del medicamento
          if (medicationsConfig?.showDosage !== false) {
            doc.fontSize(10).font('Helvetica').text(`   Dosis: ${medication.dosage}`, { indent: 20 });
          }
          if (medicationsConfig?.showFrequency !== false) {
            doc.fontSize(10).font('Helvetica').text(`   Frecuencia: ${medication.frequency}`, {
              indent: 20,
            });
          }
          if (medicationsConfig?.showDuration !== false) {
            doc.fontSize(10).font('Helvetica').text(`   Duración: ${medication.duration} días`, {
              indent: 20,
            });
          }
          if (medicationsConfig?.showQuantity !== false) {
            doc.fontSize(10).font('Helvetica').text(`   Cantidad: ${medication.quantity}`, {
              indent: 20,
            });
          }
          if (medicationsConfig?.showRoute !== false) {
            doc.fontSize(10).font('Helvetica').text(`   Vía: ${medication.route}`, { indent: 20 });
          }

          if (medicationsConfig?.showInstructions !== false && medication.instructions) {
            doc
              .fontSize(10)
              .font('Helvetica-Oblique')
              .text(`   Indicaciones: ${medication.instructions}`, {
                indent: 20,
              });
          }

          if (medicationsConfig?.showRefills !== false && medication.refillsAllowed > 0) {
            doc
              .fontSize(10)
              .font('Helvetica')
              .text(`   Refuerzos permitidos: ${medication.refillsAllowed}`, { indent: 20 });
          }

          doc.moveDown(spacing);
        }

        doc.moveDown(1);
      }

      // Instrucciones generales - Configurable
      const instructionsConfig = template?.dynamicContent?.instructions;
      if (instructionsConfig?.enabled !== false && prescription.instructions) {
        // Calcular altura real necesaria para las instrucciones
        const titleFontSize = instructionsConfig?.titleFontSize || 12;
        const contentFontSize = instructionsConfig?.contentFontSize || 10;
        const showTitle = instructionsConfig?.showTitle !== false;

        let requiredHeight = 0;
        if (showTitle) {
          requiredHeight += titleFontSize + 15; // Título + espacio
        }
        requiredHeight += this.calculateTextHeight(doc, prescription.instructions, contentFontSize, { indent: 20, font: 'Helvetica' });
        requiredHeight += 30; // Espacios adicionales y margen de seguridad

        await this.checkAndAddNewPageIfNeeded(doc, requiredHeight, template, templateVariables, heights, prescription, commerceName, commerceAddress, commercePhone, commerceLogo, doctorSignature, qrCodeDataUrl);

        const title = instructionsConfig?.title || 'INSTRUCCIONES GENERALES:';
        const titleFontFamily = instructionsConfig?.titleFontFamily || 'Helvetica-Bold';

        if (showTitle) {
          doc.fontSize(titleFontSize).font(titleFontFamily).text(title, {
            underline: true,
          });
          doc.moveDown(0.3);
        }
        doc.fontSize(contentFontSize).font('Helvetica').text(prescription.instructions, { indent: 20 });
        doc.moveDown(1);
      }

      // Observaciones - Configurable
      const observationsConfig = template?.dynamicContent?.observations;
      if (observationsConfig?.enabled !== false && prescription.observations) {
        // Calcular altura real necesaria para las observaciones
        const titleFontSize = observationsConfig?.titleFontSize || 12;
        const contentFontSize = observationsConfig?.contentFontSize || 10;
        const showTitle = observationsConfig?.showTitle !== false;

        let requiredHeight = 0;
        if (showTitle) {
          requiredHeight += titleFontSize + 15; // Título + espacio
        }
        requiredHeight += this.calculateTextHeight(doc, prescription.observations, contentFontSize, { indent: 20, font: 'Helvetica' });
        requiredHeight += 30; // Espacios adicionales y margen de seguridad

        await this.checkAndAddNewPageIfNeeded(doc, requiredHeight, template, templateVariables, heights, prescription, commerceName, commerceAddress, commercePhone, commerceLogo, doctorSignature, qrCodeDataUrl);

        const title = observationsConfig?.title || 'OBSERVACIONES:';
        const titleFontFamily = observationsConfig?.titleFontFamily || 'Helvetica-Bold';

        if (showTitle) {
          doc.fontSize(titleFontSize).font(titleFontFamily).text(title, { underline: true });
          doc.moveDown(0.3);
        }
        doc.fontSize(contentFontSize).font('Helvetica').text(prescription.observations, { indent: 20 });
        doc.moveDown(1);
      }

      // Validez - Configurable
      const validityConfig = template?.dynamicContent?.validity;
      if (validityConfig?.enabled !== false) {
        // Verificar espacio para validez (aproximadamente 40pt)
        await this.checkAndAddNewPageIfNeeded(doc, 40, template, templateVariables, heights, prescription, commerceName, commerceAddress, commercePhone, commerceLogo, doctorSignature, qrCodeDataUrl);

        const validUntilStr = new Date(prescription.validUntil).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        const label = validityConfig?.label || 'Válida hasta:';
        doc.fontSize(validityConfig?.fontSize || 10).font('Helvetica').text(`${label} ${validUntilStr}`, { align: 'right' });
        doc.moveDown(2);
      }
      } // Cerrar bloque if (!hasCanvasContent)

      // FOOTER - Renderizar en la última página (FUERA del bloque hasCanvasContent)
      this.logger.debug(`Rendering final footer at currentY=${doc.y}`);

      // Verificar si hay espacio para el footer, si no, crear nueva página
      const footerSectionFinal = template?.footer;
      const hasCanvasFooterFinal = footerSectionFinal?.elements && Array.isArray(footerSectionFinal.elements) && footerSectionFinal.elements.length > 0;

      if (hasCanvasFooterFinal) {
        const minFooterY = Math.min(...footerSectionFinal.elements.map((e: any) => e.y || 0));
        const maxFooterY = Math.max(...footerSectionFinal.elements.map((e: any) => (e.y || 0) + (e.height || 0)));
        const footerHeightFinal = maxFooterY - minFooterY;
        const marginsFinal = template?.margins || { top: 50, bottom: 50, left: 50, right: 50 };
        const footerStartYFinal = pageHeight - marginsFinal.bottom - footerHeightFinal - 10;

        // Si el cursor actual está más abajo que donde debe empezar el footer, crear nueva página
        if (doc.y > footerStartYFinal) {
          this.logger.debug(`Current Y (${doc.y}) > footerStartY (${footerStartYFinal}), adding new page for footer`);

          let docSize: any = template?.pageSize || 'A4';
          if (docSize === 'LETTER_HALF') {
            docSize = [396, 612];
          }

          doc.addPage({
            size: docSize,
            margins: marginsFinal,
            layout: template?.orientation || 'portrait'
          });

          // Renderizar header en nueva página
          await this.renderHeaderOnCurrentPage(doc, template, templateVariables, commerceLogo, commerceName, commerceAddress, commercePhone);
          doc.y = marginsFinal.top + heights.headerHeight;
        }
      }

      await this.renderFooterOnCurrentPage(doc, template, templateVariables, pageHeight, prescription, doctorSignature, qrCodeDataUrl);

      // Generar buffer del PDF
      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        const buffers: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers as Uint8Array[])));
        doc.on('error', reject);

        // Finalizar PDF
        doc.end();
      });

      // Subir a S3
      const fileName = `prescriptions/${prescription.commerceId}/${prescription.id}.pdf`;
      const bucketName = process.env.AWS_S3_COMMERCE_BUCKET || 'ett-commerce-documents';

      const uploadResult = await this.s3
        .upload({
          Bucket: bucketName,
          Key: fileName,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        })
        .promise();

      // Generar URL firmada (válida por 7 días)
      const signedUrl = this.s3.getSignedUrl('getObject', {
        Bucket: bucketName,
        Key: fileName,
        Expires: 604800, // 7 días
      });

      return {
        pdfUrl: signedUrl,
        qrCode: qrData, // Mantener para compatibilidad
        verificationUrl, // URL de verificación pública
      };
    } catch (error) {
      console.error('Error generating prescription PDF:', error);
      throw new HttpException(
        `Error generating PDF: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtener PDF de receta desde S3
   */
  async getPrescriptionPdf(prescriptionId: string, commerceId: string): Promise<Readable> {
    try {
      const fileName = `prescriptions/${commerceId}/${prescriptionId}.pdf`;
      const bucketName = process.env.AWS_S3_COMMERCE_BUCKET || 'ett-commerce-documents';

      const result = await this.s3
        .getObject({
          Bucket: bucketName,
          Key: fileName,
        })
        .promise();

      return Readable.from(result.Body as Buffer);
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        throw new HttpException('PDF not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        `Error retrieving PDF: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Generar URL firmada para descargar PDF
   */
  async getPrescriptionPdfUrl(
    prescriptionId: string,
    commerceId: string,
    expiresIn = 3600
  ): Promise<string> {
    try {
      const fileName = `prescriptions/${commerceId}/${prescriptionId}.pdf`;
      const bucketName = process.env.AWS_S3_COMMERCE_BUCKET || 'ett-commerce-documents';

      return this.s3.getSignedUrl('getObject', {
        Bucket: bucketName,
        Key: fileName,
        Expires: expiresIn,
      });
    } catch (error) {
      throw new HttpException(
        `Error generating PDF URL: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
