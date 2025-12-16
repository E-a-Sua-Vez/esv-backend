import { Readable } from 'stream';

import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

import { MedicalReference } from './model/medical-reference.entity';

@Injectable()
export class MedicalReferencePdfService {
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
   * Generar PDF de referencia médica
   */
  async generateReferencePdf(
    reference: MedicalReference,
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
        referenceId: reference.id,
        date: reference.referenceDate.toISOString(),
        commerceId: reference.commerceId,
      });
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        width: 200,
      });

      // Encabezado
      doc.fontSize(20).font('Helvetica-Bold').text('REFERENCIA MÉDICA', { align: 'center' });
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

      // Médico origen
      doc.fontSize(12).font('Helvetica-Bold').text('MÉDICO ORIGEN:', { continued: false });
      doc.fontSize(11).font('Helvetica').text(reference.doctorOriginName, { indent: 20 });
      doc.moveDown(0.5);

      // Especialidad destino
      doc.fontSize(12).font('Helvetica-Bold').text('ESPECIALIDAD DESTINO:', { continued: false });
      doc.fontSize(11).font('Helvetica').text(reference.specialtyDestination, { indent: 20 });

      if (reference.doctorDestinationName) {
        doc
          .fontSize(11)
          .font('Helvetica')
          .text(`Dr(a). ${reference.doctorDestinationName}`, { indent: 20 });
      }
      doc.moveDown(0.5);

      // Fecha
      const dateStr = new Date(reference.referenceDate).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      doc.fontSize(12).font('Helvetica-Bold').text('FECHA:', { continued: false });
      doc.fontSize(11).font('Helvetica').text(dateStr, { indent: 20 });
      doc.moveDown(0.5);

      // Urgencia
      const urgencyLabel =
        reference.urgency === 'urgent'
          ? 'Urgente'
          : reference.urgency === 'preferred'
          ? 'Preferencial'
          : 'Rutina';
      doc.fontSize(12).font('Helvetica-Bold').text('URGENCIA:', { continued: false });
      doc.fontSize(11).font('Helvetica').text(urgencyLabel, { indent: 20 });
      doc.moveDown(1);

      // Línea separadora
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // Motivo de referencia
      doc.fontSize(14).font('Helvetica-Bold').text('MOTIVO DE REFERENCIA:', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').text(reference.reason, { indent: 20 });
      doc.moveDown(1);

      // Diagnóstico presuntivo
      if (reference.presumptiveDiagnosis) {
        doc.fontSize(12).font('Helvetica-Bold').text('DIAGNÓSTICO PRESUNTIVO:', {
          underline: true,
        });
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica').text(reference.presumptiveDiagnosis, { indent: 20 });
        doc.moveDown(1);
      }

      // Estudios realizados
      if (reference.studiesPerformed) {
        doc.fontSize(12).font('Helvetica-Bold').text('ESTUDIOS REALIZADOS:', {
          underline: true,
        });
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica').text(reference.studiesPerformed, { indent: 20 });
        doc.moveDown(1);
      }

      // Tratamiento actual
      if (reference.currentTreatment) {
        doc.fontSize(12).font('Helvetica-Bold').text('TRATAMIENTO ACTUAL:', {
          underline: true,
        });
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica').text(reference.currentTreatment, { indent: 20 });
        doc.moveDown(1);
      }

      // Informe de retorno
      if (reference.returnReport) {
        doc.fontSize(12).font('Helvetica-Bold').text('INFORME DE RETORNO:', {
          underline: true,
        });
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica').text(reference.returnReport, { indent: 20 });
        doc.moveDown(1);
      }

      // Estado
      const statusLabel =
        reference.status === 'pending'
          ? 'Pendiente'
          : reference.status === 'accepted'
          ? 'Aceptada'
          : reference.status === 'attended'
          ? 'Atendida'
          : reference.status === 'rejected'
          ? 'Rechazada'
          : 'Cancelada';
      doc.fontSize(10).font('Helvetica').text(`Estado: ${statusLabel}`, { align: 'right' });
      doc.moveDown(2);

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
      doc.fontSize(10).font('Helvetica-Bold').text(reference.doctorOriginName, { align: 'center' });

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
      const fileName = `medical-references/${reference.commerceId}/${reference.id}.pdf`;
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
      console.error('Error generating reference PDF:', error);
      throw new HttpException(
        `Error generating PDF: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtener PDF de referencia desde S3
   */
  async getReferencePdf(referenceId: string, commerceId: string): Promise<Readable> {
    try {
      const fileName = `medical-references/${commerceId}/${referenceId}.pdf`;
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
  async getReferencePdfUrl(
    referenceId: string,
    commerceId: string,
    expiresIn = 3600
  ): Promise<string> {
    try {
      const fileName = `medical-references/${commerceId}/${referenceId}.pdf`;
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
