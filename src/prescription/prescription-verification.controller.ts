import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import * as crypto from 'crypto';

import { PrescriptionService } from './prescription.service';
import { CommerceService } from '../commerce/commerce.service';
import { VerifyPrescriptionResponseDto } from './dto/verify-prescription.dto';

/**
 * Controlador público para verificación de prescripciones
 * No requiere autenticación - accesible públicamente para verificación
 */
@ApiTags('public-verification')
@Controller('public/prescription')
export class PrescriptionVerificationController {
  constructor(
    private readonly prescriptionService: PrescriptionService,
    private readonly commerceService: CommerceService
  ) {}

  @Get('/verify/:id')
  @ApiOperation({
    summary: 'Verificar prescripción médica',
    description:
      'Endpoint público para verificar la autenticidad de una prescripción médica mediante su ID. No requiere autenticación.',
  })
  @ApiParam({ name: 'id', description: 'ID de la prescripción' })
  @ApiResponse({
    status: 200,
    description: 'Información de verificación de la prescripción',
    type: VerifyPrescriptionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Prescripción no encontrada' })
  async verifyPrescription(
    @Param('id') id: string
  ): Promise<VerifyPrescriptionResponseDto> {
    try {
      // Obtener prescripción (sin restricciones de autenticación)
      const prescription = await this.prescriptionService.getPrescriptionById(id);

      if (!prescription) {
        throw new HttpException('Prescripción no encontrada', HttpStatus.NOT_FOUND);
      }

      // Obtener información del comercio
      const commerce = await this.commerceService.getCommerceById(prescription.commerceId);

      // Calcular hash del documento para verificación de integridad
      const hashData = JSON.stringify({
        id: prescription.id,
        date: prescription.date.toISOString(),
        doctorId: prescription.doctorId,
        doctorLicense: prescription.doctorLicense,
        commerceId: prescription.commerceId,
        clientId: prescription.clientId,
        medications: prescription.medications.map((m) => ({
          medicationId: m.medicationId,
          dosage: m.dosage,
          frequency: m.frequency,
        })),
      });

      const calculatedHash = crypto.createHash('sha256').update(hashData).digest('hex');

      // Verificar integridad comparando con hash almacenado
      const isTampered = prescription.documentHash
        ? prescription.documentHash !== calculatedHash
        : false;

      const isValid = !isTampered;

      return {
        valid: isValid,
        prescriptionId: prescription.id,
        date: prescription.date,
        doctorName: prescription.doctorName,
        doctorLicense: prescription.doctorLicense,
        commerceName: commerce?.name || 'Clínica',
        documentHash: calculatedHash,
        message: isValid
          ? 'Documento válido y auténtico'
          : 'Documento puede haber sido alterado',
        tampered: isTampered,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error al verificar la prescripción',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

