import { Readable } from 'stream';

import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

import { Prescription, MedicationItem } from './model/prescription.entity';

@Injectable()
export class PrescriptionPdfService {
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
   * Generar PDF de receta médica
   */
  async generatePrescriptionPdf(
    prescription: Prescription,
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
        prescriptionId: prescription.id,
        date: prescription.date.toISOString(),
        doctorLicense: prescription.doctorLicense,
        commerceId: prescription.commerceId,
      });
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        width: 200,
      });

      // Encabezado
      doc.fontSize(20).font('Helvetica-Bold').text('RECETA MÉDICA', { align: 'center' });
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
      doc.fontSize(12).font('Helvetica-Bold').text('MÉDICO:', { continued: false });
      doc.fontSize(11).font('Helvetica').text(prescription.doctorName, { indent: 20 });
      if (prescription.doctorLicense) {
        doc
          .fontSize(10)
          .font('Helvetica')
          .text(`CRM: ${prescription.doctorLicense}`, { indent: 20 });
      }
      doc.moveDown(0.5);

      // Fecha
      const dateStr = new Date(prescription.date).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      doc.fontSize(12).font('Helvetica-Bold').text('FECHA:', { continued: false });
      doc.fontSize(11).font('Helvetica').text(dateStr, { indent: 20 });
      doc.moveDown(1);

      // Línea separadora
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // Medicamentos
      doc.fontSize(14).font('Helvetica-Bold').text('MEDICAMENTOS:', { underline: true });
      doc.moveDown(0.5);

      prescription.medications.forEach((medication: MedicationItem, index: number) => {
        const medNumber = index + 1;

        // Nombre del medicamento
        doc.fontSize(12).font('Helvetica-Bold').text(`${medNumber}. ${medication.medicationName}`, {
          indent: 20,
        });

        if (medication.commercialName) {
          doc.fontSize(10).font('Helvetica-Oblique').text(`   (${medication.commercialName})`, {
            indent: 20,
          });
        }

        // Detalles del medicamento
        doc.fontSize(10).font('Helvetica').text(`   Dosis: ${medication.dosage}`, { indent: 20 });
        doc.fontSize(10).font('Helvetica').text(`   Frecuencia: ${medication.frequency}`, {
          indent: 20,
        });
        doc.fontSize(10).font('Helvetica').text(`   Duración: ${medication.duration} días`, {
          indent: 20,
        });
        doc.fontSize(10).font('Helvetica').text(`   Cantidad: ${medication.quantity}`, {
          indent: 20,
        });
        doc.fontSize(10).font('Helvetica').text(`   Vía: ${medication.route}`, { indent: 20 });

        if (medication.instructions) {
          doc
            .fontSize(10)
            .font('Helvetica-Oblique')
            .text(`   Indicaciones: ${medication.instructions}`, {
              indent: 20,
            });
        }

        if (medication.refillsAllowed > 0) {
          doc
            .fontSize(10)
            .font('Helvetica')
            .text(`   Refuerzos permitidos: ${medication.refillsAllowed}`, { indent: 20 });
        }

        doc.moveDown(0.5);
      });

      doc.moveDown(1);

      // Instrucciones generales
      if (prescription.instructions) {
        doc.fontSize(12).font('Helvetica-Bold').text('INSTRUCCIONES GENERALES:', {
          underline: true,
        });
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica').text(prescription.instructions, { indent: 20 });
        doc.moveDown(1);
      }

      // Observaciones
      if (prescription.observations) {
        doc.fontSize(12).font('Helvetica-Bold').text('OBSERVACIONES:', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica').text(prescription.observations, { indent: 20 });
        doc.moveDown(1);
      }

      // Validez
      const validUntilStr = new Date(prescription.validUntil).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      doc.fontSize(10).font('Helvetica').text(`Válida hasta: ${validUntilStr}`, { align: 'right' });
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

      // Pie de página con QR Code (posicionado en la parte inferior derecha)
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

      // Firma del médico (centrada en la parte inferior)
      const signatureY = doc.page.height - marginBottom - 60;
      doc.y = signatureY;
      doc.fontSize(10).font('Helvetica').text('_________________________', {
        align: 'center',
      });
      doc.fontSize(10).font('Helvetica-Bold').text(prescription.doctorName, { align: 'center' });
      if (prescription.doctorLicense) {
        doc.fontSize(9).font('Helvetica').text(`CRM: ${prescription.doctorLicense}`, {
          align: 'center',
        });
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
      const fileName = `prescriptions/${prescription.commerceId}/${prescription.id}.pdf`;
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
