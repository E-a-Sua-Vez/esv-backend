import { Readable } from 'stream';

import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

import { MedicalExamOrder } from './model/medical-exam-order.entity';

@Injectable()
export class MedicalExamOrderPdfService {
  private s3: AWS.S3;

  constructor() {
    this.s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      region: process.env.AWS_DEFAULT_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
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
    commercePhone?: string
  ): Promise<{ pdfUrl: string; qrCode: string }> {
    try {
      // Crear documento PDF
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      // Generar código QR
      const qrData = JSON.stringify({
        examOrderId: examOrder.id,
        date: examOrder.requestedAt.toISOString(),
        commerceId: examOrder.commerceId,
      });
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        width: 200,
      });

      // Encabezado
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('ORDEN DE EXÁMENES MÉDICOS', { align: 'center' });
      doc.moveDown(0.5);

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

      // Línea separadora
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // Información del paciente
      doc.fontSize(12).font('Helvetica-Bold').text('PACIENTE:', { continued: false });
      doc.fontSize(11).font('Helvetica').text(patientName, { indent: 20 });
      doc.fontSize(10).font('Helvetica').text(`ID: ${patientIdNumber}`, { indent: 20 });
      doc.moveDown(0.5);

      // Información del médico
      doc.fontSize(12).font('Helvetica-Bold').text('MÉDICO SOLICITANTE:', { continued: false });
      doc.fontSize(11).font('Helvetica').text(examOrder.doctorName, { indent: 20 });
      doc.moveDown(0.5);

      // Fecha
      const dateStr = new Date(examOrder.requestedAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      doc.fontSize(12).font('Helvetica-Bold').text('FECHA:', { continued: false });
      doc.fontSize(11).font('Helvetica').text(dateStr, { indent: 20 });
      doc.moveDown(0.5);

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

      // Línea separadora
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // Exámenes solicitados
      doc.fontSize(14).font('Helvetica-Bold').text('EXÁMENES SOLICITADOS:', { underline: true });
      doc.moveDown(0.5);

      examOrder.exams.forEach((exam, index) => {
        const examNumber = index + 1;

        // Nombre del examen
        doc.fontSize(12).font('Helvetica-Bold').text(`${examNumber}. ${exam.examName}`, {
          indent: 20,
        });

        if (exam.examCode) {
          doc.fontSize(10).font('Helvetica-Oblique').text(`   Código: ${exam.examCode}`, {
            indent: 20,
          });
        }

        if (exam.preparation) {
          doc.fontSize(10).font('Helvetica').text(`   Preparación: ${exam.preparation}`, {
            indent: 20,
          });
        }

        if (exam.instructions) {
          doc
            .fontSize(10)
            .font('Helvetica-Oblique')
            .text(`   Instrucciones: ${exam.instructions}`, {
              indent: 20,
            });
        }

        doc.moveDown(0.5);
      });

      doc.moveDown(1);

      // Justificación clínica
      if (examOrder.clinicalJustification) {
        doc.fontSize(12).font('Helvetica-Bold').text('JUSTIFICACIÓN CLÍNICA:', {
          underline: true,
        });
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica').text(examOrder.clinicalJustification, { indent: 20 });
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

      // Firma del médico
      const signatureY = doc.page.height - marginBottom - 60;
      doc.y = signatureY;
      doc.fontSize(10).font('Helvetica').text('_________________________', {
        align: 'center',
      });
      doc.fontSize(10).font('Helvetica-Bold').text(examOrder.doctorName, { align: 'center' });

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
          ACL: 'private',
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
        qrCode: qrData,
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
