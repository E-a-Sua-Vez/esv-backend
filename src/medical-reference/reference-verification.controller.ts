import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import * as crypto from 'crypto';

import { MedicalReferenceService } from './medical-reference.service';
import { CommerceService } from '../commerce/commerce.service';
import { VerifyReferenceResponseDto } from './dto/verify-reference.dto';

/**
 * Controlador público para verificación de referencias médicas
 * No requiere autenticación - accesible públicamente para verificación
 */
@ApiTags('public-verification')
@Controller('public/reference')
export class ReferenceVerificationController {
  constructor(
    private readonly referenceService: MedicalReferenceService,
    private readonly commerceService: CommerceService
  ) {}

  @Get('/verify/:id')
  @ApiOperation({
    summary: 'Verificar referencia médica',
    description:
      'Endpoint público para verificar la autenticidad de una referencia médica mediante su ID. No requiere autenticación.',
  })
  @ApiParam({ name: 'id', description: 'ID de la referencia médica' })
  @ApiResponse({
    status: 200,
    description: 'Información de verificación de la referencia médica',
    type: VerifyReferenceResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Referencia médica no encontrada' })
  async verifyReference(@Param('id') id: string): Promise<VerifyReferenceResponseDto> {
    try {
      const reference = await this.referenceService.getReferenceById(id);

      if (!reference) {
        throw new HttpException('Referencia médica no encontrada', HttpStatus.NOT_FOUND);
      }

      const commerce = await this.commerceService.getCommerceById(reference.commerceId);

      const hashData = JSON.stringify({
        id: reference.id,
        date: reference.referenceDate.toISOString(),
        doctorOriginId: reference.doctorOriginId,
        commerceId: reference.commerceId,
        clientId: reference.clientId,
        specialtyDestination: reference.specialtyDestination,
      });

      const calculatedHash = crypto.createHash('sha256').update(hashData).digest('hex');

      // Verificar integridad comparando con hash almacenado
      const isTampered = reference.documentHash
        ? reference.documentHash !== calculatedHash
        : false;

      const isValid = !isTampered;

      return {
        valid: isValid,
        referenceId: reference.id,
        date: reference.referenceDate,
        doctorOriginName: reference.doctorOriginName,
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
        'Error al verificar la referencia médica',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

