import { Readable } from 'stream';

import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as AWS from 'aws-sdk';
const PDFDocument = require('pdfkit');
import * as QRCode from 'qrcode';
import * as https from 'https';
import * as http from 'http';

import { MedicalExamOrder } from './model/medical-exam-order.entity';
import { CollaboratorService } from '../collaborator/collaborator.service';
import { ProfessionalService } from '../professional/professional.service';

@Injectable()
export class MedicalExamOrderPdfService {
  private s3: AWS.S3;
  private readonly logger = new Logger(MedicalExamOrderPdfService.name);

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
    }
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
        const y = element.y || 0;
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
      // Si es base64
      if (urlOrBase64.startsWith('data:image')) {
        const base64Data = urlOrBase64.split(',')[1];
        return Buffer.from(base64Data, 'base64');
      }

      // Si es URL
      return new Promise((resolve, reject) => {
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
            const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
            if (totalSize > 5 * 1024 * 1024) {
              // 5MB
              response.destroy();
              reject(new Error('Image size exceeds 5MB limit'));
              return;
            }
          });
          response.on('end', () => {
            const buffer = Buffer.concat(chunks);
            if (this.validateImageSize(buffer)) {
              resolve(buffer);
            } else {
              reject(new Error('Image size exceeds 5MB limit'));
            }
          });
          response.on('error', reject);
        });

        request.setTimeout(timeout, () => {
          request.destroy();
          reject(new Error('Image load timeout'));
        });

        request.on('error', reject);
      });
    } catch (error) {
      this.logger.error(`Error loading image: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Generar PDF de orden de examen médico
   */
  async generateExamOrderPdf(
    examOrder: MedicalExamOrder,
    patientName: string,
    patientIdNumber: string,
    commerceName: string,
    commerceAddress?: string,
    commercePhone?: string,
    commerceLogo?: string, // URL del logo del commerce
    doctorSignature?: string, // URL o base64 de la firma digital del médico
    template?: any, // PdfTemplate opcional
    doctorLicense?: string // Número de licencia médica (CRM) - obtenido del colaborador
  ): Promise<{ pdfUrl: string; qrCode: string; verificationUrl: string }> {
    try {
      // Crear documento PDF
      const pageSize = template?.pageSize || 'A4';
      const margins = template?.margins || { top: 50, bottom: 50, left: 50, right: 50 };
      const orientation = template?.orientation || 'portrait';

      let docSize: any = pageSize;
      if (pageSize === 'LETTER_HALF') {
        docSize = [396, 612];
      }

      const doc = new PDFDocument({
        size: docSize,
        margins,
        layout: orientation,
      });

      // Generar URL de verificación pública
      const baseUrl = process.env.FRONTEND_URL || process.env.BACKEND_URL || 'https://estuturno.app';
      const verificationUrl = `${baseUrl}/verify/exam-order/${examOrder.id}`;

      // Generar código QR con URL de verificación
      const qrData = verificationUrl;
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        width: 200,
      });

      // Obtener variables médicas extendidas del colaborador
      // Obtener variables médicas extendidas del profesional o colaborador (fallback)
      const extendedDoctorVariables = await this.getDoctorVariables(
        examOrder.professionalId,
        examOrder.collaboratorId // fallback
      );

      // Variables disponibles para templates (EXTENDIDAS con datos médicos)
      const templateVariables = {
        verificationUrl,
        patientName,
        patientIdNumber,
        commerceName,
        commerceAddress,
        commercePhone,
        doctorName: examOrder.doctorName,
        doctorLicense: doctorLicense || undefined,
        date: new Date(examOrder.requestedAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        commerceLogo,
        doctorSignature,
        // Variables médicas extendidas
        ...extendedDoctorVariables,
      };

      // HEADER - Usar template si existe, sino usar default
      const headerSection = template?.header;
      if (headerSection?.enabled) {
        // Si hay elementos del canvas, renderizarlos primero
        if (headerSection.elements && Array.isArray(headerSection.elements) && headerSection.elements.length > 0) {
          await this.renderCanvasElements(doc, headerSection.elements, templateVariables);
        } else {
          // Modo legacy: usar flags y texto simple
          if (headerSection.includeLogo && commerceLogo) {
            try {
              const logoBuffer = await this.loadImageFromUrl(commerceLogo);
              if (logoBuffer) {
                const logoSize = 80;
                const logoX = (doc.page.width - logoSize) / 2;
                doc.image(logoBuffer, logoX, doc.y, { width: logoSize, height: logoSize });
                doc.moveDown(1.5);
              }
            } catch (error) {
              this.logger.warn(`Could not load logo: ${error.message}`);
            }
          }

          if (headerSection.text) {
            const text = this.replaceVariables(headerSection.text, templateVariables);
            doc.fontSize(headerSection.fontSize || 20)
              .font(headerSection.fontFamily || 'Helvetica-Bold')
              .fillColor(headerSection.color || '#000000')
              .text(text, {
                align: headerSection.alignment || 'center',
              });
            doc.moveDown(0.5);
          }

          if (headerSection.includeCommerceInfo) {
            if (commerceName) {
              doc.fontSize(12).font('Helvetica-Bold').text(commerceName, { align: 'center' });
            }
            if (commerceAddress) {
              doc.fontSize(10).font('Helvetica').text(commerceAddress, { align: 'center' });
            }
            if (commercePhone) {
              doc.fontSize(10).font('Helvetica').text(`Tel: ${commercePhone}`, { align: 'center' });
            }
          }
        }
      } else {
        // Header por defecto
        doc.fontSize(20).font('Helvetica-Bold').text('ORDEN DE EXÁMENES MÉDICOS', {
          align: 'center',
        });
        doc.moveDown(0.5);

        // Logo si está disponible
        if (commerceLogo) {
          try {
            const logoBuffer = await this.loadImageFromUrl(commerceLogo);
            if (logoBuffer) {
              const logoSize = 60;
              const logoX = (doc.page.width - logoSize) / 2;
              doc.image(logoBuffer, logoX, doc.y, { width: logoSize, height: logoSize });
              doc.moveDown(1);
            }
          } catch (error) {
            this.logger.warn(`Could not load logo: ${error.message}`);
          }
        }

        // Información del comercio/clínica
        if (commerceName) {
          doc.fontSize(12).font('Helvetica-Bold').text(commerceName, { align: 'center' });
        }
        if (commerceAddress) {
          doc.fontSize(10).font('Helvetica').text(commerceAddress, { align: 'center' });
        }
        if (commercePhone) {
          doc.fontSize(10).font('Helvetica').text(`Tel: ${commercePhone}`, { align: 'center' });
        }
        doc.moveDown(1);
      }

      // Línea separadora
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // Información del paciente - Configurable
      const patientInfo = template?.dynamicContent?.patientInfo;
      if (patientInfo?.enabled !== false) {
        const labelFontSize = patientInfo?.labelFontSize || 12;
        const valueFontSize = patientInfo?.valueFontSize || 11;
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
        const labelFontSize = doctorInfo?.labelFontSize || 12;
        const valueFontSize = doctorInfo?.valueFontSize || 11;
        const spacing = doctorInfo?.spacing || 0.5;

        if (doctorInfo?.showName !== false) {
          doc.fontSize(labelFontSize).font('Helvetica-Bold').text('MÉDICO SOLICITANTE:', { continued: false });
          doc.fontSize(valueFontSize).font('Helvetica').text(examOrder.doctorName, { indent: 20 });
        }
        if (doctorInfo?.showLicense !== false && doctorLicense) {
          doc.fontSize(10).font('Helvetica').text(`CRM: ${doctorLicense}`, { indent: 20 });
        }
        doc.moveDown(spacing);
      }

      // Fecha - Configurable
      const dateInfo = template?.dynamicContent?.dateInfo;
      if (dateInfo?.enabled !== false) {
        const dateStr = new Date(examOrder.requestedAt).toLocaleDateString(
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
        doc.moveDown(0.5);
      }

      // Prioridad
      const priorityLabel =
        examOrder.priority === 'urgent'
          ? 'Urgente'
          : examOrder.priority === 'emergency'
          ? 'Emergencia'
          : 'Rutina';
      doc.fontSize(12).font('Helvetica-Bold').text('PRIORIDAD:', { continued: false });
      doc.fontSize(11).font('Helvetica').text(priorityLabel, { indent: 20 });
      doc.moveDown(0.5);

      // Tipo de examen
      const typeLabel =
        examOrder.type === 'laboratory'
          ? 'Laboratorio'
          : examOrder.type === 'imaging'
          ? 'Imagenología'
          : examOrder.type === 'procedure'
          ? 'Procedimiento'
          : 'Otro';
      doc.fontSize(12).font('Helvetica-Bold').text('TIPO:', { continued: false });
      doc.fontSize(11).font('Helvetica').text(typeLabel, { indent: 20 });
      doc.moveDown(1);

      // CONTENT - Usar template si existe, sino usar default
      const contentSection = template?.content;
      if (contentSection?.enabled) {
        // Si hay elementos del canvas, renderizarlos
        if (contentSection.elements && Array.isArray(contentSection.elements) && contentSection.elements.length > 0) {
          await this.renderCanvasElements(doc, contentSection.elements, templateVariables);
        } else if (contentSection.text) {
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
      }

      // Línea separadora
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // Exámenes solicitados - Configurable
      const examsConfig = template?.dynamicContent?.exams;
      if (examsConfig?.enabled !== false) {
        const titleFontSize = examsConfig?.titleFontSize || 14;
        const titleFontFamily = examsConfig?.titleFontFamily || 'Helvetica-Bold';
        const itemFontSize = examsConfig?.itemFontSize || 12;
        const detailFontSize = examsConfig?.detailFontSize || 10;
        const showTitle = examsConfig?.showTitle !== false;

        if (showTitle) {
          doc.fontSize(titleFontSize).font(titleFontFamily).text('EXÁMENES SOLICITADOS:', { underline: true });
          doc.moveDown(0.5);
        }

        examOrder.exams.forEach((exam, index) => {
          const examNumber = index + 1;

          // Nombre del examen
          if (examsConfig?.showName !== false) {
            doc.fontSize(itemFontSize).font('Helvetica-Bold').text(`${examNumber}. ${exam.examName}`, {
              indent: 20,
            });
          }

          if (examsConfig?.showCode !== false && exam.examCode) {
            doc.fontSize(detailFontSize).font('Helvetica-Oblique').text(`   Código: ${exam.examCode}`, {
              indent: 20,
            });
          }

          if (examsConfig?.showPreparation !== false && exam.preparation) {
            doc.fontSize(detailFontSize).font('Helvetica').text(`   Preparación: ${exam.preparation}`, {
              indent: 20,
            });
          }

          if (examsConfig?.showInstructions !== false && exam.instructions) {
            doc
              .fontSize(detailFontSize)
              .font('Helvetica-Oblique')
              .text(`   Instrucciones: ${exam.instructions}`, {
                indent: 20,
              });
          }

          doc.moveDown(0.5);
        });

        doc.moveDown(1);
      }

      // Justificación clínica - Configurable
      const justificationConfig = template?.dynamicContent?.clinicalJustification;
      if (justificationConfig?.enabled !== false && examOrder.clinicalJustification) {
        const titleFontSize = justificationConfig?.titleFontSize || 12;
        const titleFontFamily = justificationConfig?.titleFontFamily || 'Helvetica-Bold';
        const contentFontSize = justificationConfig?.contentFontSize || 10;
        const showTitle = justificationConfig?.showTitle !== false;

        if (showTitle) {
          doc.fontSize(titleFontSize).font(titleFontFamily).text('JUSTIFICACIÓN CLÍNICA:', {
            underline: true,
          });
          doc.moveDown(0.3);
        }
        doc.fontSize(contentFontSize).font('Helvetica').text(examOrder.clinicalJustification, { indent: 20 });
        doc.moveDown(1);
      }

      // Fecha programada
      if (examOrder.scheduledDate) {
        const scheduledStr = new Date(examOrder.scheduledDate).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        doc
          .fontSize(10)
          .font('Helvetica')
          .text(`Fecha programada: ${scheduledStr}`, { align: 'right' });
      }

      // Verificar si necesitamos una nueva página para la firma
      const currentY = doc.y;
      const pageHeight = doc.page.height;
      const marginBottom = 50;
      const signatureHeight = 100;
      const qrHeight = 100;

      if (currentY + signatureHeight + qrHeight > pageHeight - marginBottom) {
        doc.addPage();
      }

      // Pie de página con QR Code
      const qrImageBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
      const qrSize = 80;
      const qrX = doc.page.width - 50 - qrSize;
      const qrY = doc.page.height - marginBottom - qrSize - 20;

      doc.image(qrImageBuffer, qrX, qrY, {
        width: qrSize,
        height: qrSize,
      });

      doc
        .fontSize(8)
        .font('Helvetica')
        .text('Código QR para verificación', qrX, qrY + qrSize + 5, {
          width: qrSize,
          align: 'center',
        });

      // FOOTER - Usar template si existe, sino usar default
      const footerSection = template?.footer;
      const signatureY = doc.page.height - marginBottom - 60;
      doc.y = signatureY;

      if (footerSection?.enabled) {
        // Si hay elementos del canvas, renderizarlos
        if (footerSection.elements && Array.isArray(footerSection.elements) && footerSection.elements.length > 0) {
          await this.renderCanvasElements(doc, footerSection.elements, templateVariables);
        } else {
          // Modo legacy: usar flags y texto simple
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

          if (footerSection.includeDoctorInfo) {
            doc.fontSize(10).font('Helvetica-Bold').text(examOrder.doctorName, {
              align: 'center',
            });
            if (doctorLicense) {
              doc.fontSize(9).font('Helvetica').text(`CRM: ${doctorLicense}`, {
                align: 'center',
              });
            }
          }

          if (footerSection.text) {
            const text = this.replaceVariables(footerSection.text, templateVariables);
            doc.fontSize(footerSection.fontSize || 8)
              .font(footerSection.fontFamily || 'Helvetica')
              .fillColor(footerSection.color || '#666666')
              .text(text, {
                align: footerSection.alignment || 'center',
              });
          }
        }
      } else {
        // Footer por defecto
        doc.fontSize(10).font('Helvetica').text('_________________________', {
          align: 'center',
        });
        doc.fontSize(10).font('Helvetica-Bold').text(examOrder.doctorName, { align: 'center' });
        if (doctorLicense) {
          doc.fontSize(9).font('Helvetica').text(`CRM: ${doctorLicense}`, {
            align: 'center',
          });
        }
      }

      // Generar buffer del PDF
      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        const buffers: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Finalizar PDF
        doc.end();
      });

      // Subir a S3
      const fileName = `exam-orders/${examOrder.commerceId}/${examOrder.id}.pdf`;
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
      console.error('Error generating exam order PDF:', error);
      throw new HttpException(
        `Error generating PDF: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtener PDF de orden de examen desde S3
   */
  async getExamOrderPdf(examOrderId: string, commerceId: string): Promise<Readable> {
    try {
      const fileName = `exam-orders/${commerceId}/${examOrderId}.pdf`;
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
  async getExamOrderPdfUrl(
    examOrderId: string,
    commerceId: string,
    expiresIn = 3600
  ): Promise<string> {
    try {
      const fileName = `exam-orders/${commerceId}/${examOrderId}.pdf`;
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
