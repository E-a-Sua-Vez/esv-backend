import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import * as crypto from 'crypto';

import { MedicalExamOrderService } from './medical-exam-order.service';
import { CommerceService } from '../commerce/commerce.service';
import { VerifyExamOrderResponseDto } from './dto/verify-exam-order.dto';

/**
 * Controlador público para verificación de órdenes de examen
 * No requiere autenticación - accesible públicamente para verificación
 */
@ApiTags('public-verification')
@Controller('public/exam-order')
export class ExamOrderVerificationController {
  constructor(
    private readonly examOrderService: MedicalExamOrderService,
    private readonly commerceService: CommerceService
  ) {}

  @Get('/verify/:id')
  @ApiOperation({
    summary: 'Verificar orden de examen médico',
    description:
      'Endpoint público para verificar la autenticidad de una orden de examen médico mediante su ID. No requiere autenticación.',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de examen' })
  @ApiResponse({
    status: 200,
    description: 'Información de verificación de la orden de examen',
    type: VerifyExamOrderResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Orden de examen no encontrada' })
  async verifyExamOrder(@Param('id') id: string): Promise<VerifyExamOrderResponseDto> {
    try {
      const examOrder = await this.examOrderService.getExamOrderById(id);

      if (!examOrder) {
        throw new HttpException('Orden de examen no encontrada', HttpStatus.NOT_FOUND);
      }

      const commerce = await this.commerceService.getCommerceById(examOrder.commerceId);

      const hashData = JSON.stringify({
        id: examOrder.id,
        date: examOrder.requestedAt.toISOString(),
        doctorId: examOrder.doctorId,
        commerceId: examOrder.commerceId,
        clientId: examOrder.clientId,
        exams: examOrder.exams.map((e) => ({
          examId: e.examId,
          examName: e.examName,
        })),
      });

      const calculatedHash = crypto.createHash('sha256').update(hashData).digest('hex');

      // Verificar integridad comparando con hash almacenado
      const isTampered = examOrder.documentHash
        ? examOrder.documentHash !== calculatedHash
        : false;

      const isValid = !isTampered;

      return {
        valid: isValid,
        examOrderId: examOrder.id,
        date: examOrder.requestedAt,
        doctorName: examOrder.doctorName,
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
        'Error al verificar la orden de examen',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

