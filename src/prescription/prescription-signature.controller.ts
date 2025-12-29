import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { User } from '../auth/user.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { PrescriptionService } from './prescription.service';
import { DigitalSignatureService } from '../shared/services/digital-signature.service';
import { AuditLogService } from '../shared/services/audit-log.service';
import { CrmValidationService } from '../shared/services/crm-validation.service';
import { getRepository } from 'fireorm';
import { publish } from 'ett-events-lib';
import { Prescription } from './model/prescription.entity';
import DocumentSigned from '../shared/events/DocumentSigned';

/**
 * Controlador para assinatura digital de prescrições
 * Conformidade: CFM Resolução 1.821/2007, ANVISA RDC 36/2013
 */
@ApiTags('prescription-signature')
@Controller('prescription')
export class PrescriptionSignatureController {
  private prescriptionRepository = getRepository(Prescription);

  constructor(
    private readonly prescriptionService: PrescriptionService,
    private readonly digitalSignatureService: DigitalSignatureService,
    private readonly auditLogService: AuditLogService,
    private readonly crmValidationService: CrmValidationService
  ) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assinar prescrição com certificado digital ICP-Brasil',
    description: 'Assina uma prescrição usando certificado digital ICP-Brasil (PKCS#7). Após assinatura, o documento não pode ser alterado.',
  })
  @ApiParam({ name: 'id', description: 'ID da prescrição' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        certificatePem: { type: 'string', description: 'Certificado em formato PEM' },
        privateKeyPem: { type: 'string', description: 'Chave privada em formato PEM' },
        password: { type: 'string', description: 'Senha do certificado (se necessário)' },
      },
      required: ['certificatePem', 'privateKeyPem'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Prescrição assinada com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Prescrição já assinada ou certificado inválido',
  })
  async signPrescription(
    @Param('id') id: string,
    @Body() body: { certificatePem: string; privateKeyPem: string; password?: string },
    @User() user: any
  ) {
    try {
      const prescription = await this.prescriptionService.getPrescriptionById(id);

      // Verificar se já está assinada
      if (prescription.isSigned) {
        throw new HttpException(
          'Prescrição já está assinada e não pode ser alterada',
          HttpStatus.BAD_REQUEST
        );
      }

      // Validar CRM se disponível
      if (prescription.doctorLicense) {
        const crmParts = prescription.doctorLicense.split('-');
        if (crmParts.length === 2) {
          const crmValidation = await this.crmValidationService.validateCrm(
            crmParts[0],
            crmParts[1]
          );
          if (!crmValidation.valid) {
            throw new HttpException(
              `CRM inválido: ${crmValidation.errors?.join(', ')}`,
              HttpStatus.BAD_REQUEST
            );
          }
        }
      }

      // Preparar conteúdo do documento para assinatura
      const documentContent = JSON.stringify({
        id: prescription.id,
        date: prescription.date.toISOString(),
        doctorId: prescription.doctorId,
        doctorLicense: prescription.doctorLicense,
        commerceId: prescription.commerceId,
        clientId: prescription.clientId,
        medications: prescription.medications,
      });

      // Assinar documento
      const signatureResult = await this.digitalSignatureService.signDocument(
        documentContent,
        body.certificatePem,
        body.privateKeyPem,
        body.password
      );

      // Atualizar prescrição com assinatura
      prescription.digitalSignature = signatureResult.signature;
      prescription.signedAt = signatureResult.timestamp;
      prescription.signedBy = user.id || user.userId || user;
      prescription.certificateInfo = signatureResult.certificateInfo;
      prescription.isSigned = true;
      prescription.updatedAt = new Date();
      prescription.updatedBy = user.id || user.userId || user;

            await this.prescriptionRepository.update(prescription);

            // Publicar evento
            const event = new DocumentSigned(new Date(), {
              documentId: prescription.id,
              documentType: 'prescription',
              signedBy: prescription.signedBy,
              signedAt: prescription.signedAt,
              certificateInfo: prescription.certificateInfo,
            }, { user: user.id || user.userId || user });
            publish(event);

            // Registrar auditoria
      await this.auditLogService.logAction(
        user.id || user.userId || user,
        'SIGN',
        'prescription',
        prescription.id,
        {
          userName: user.name || user.email,
          userEmail: user.email,
          entityName: `Prescrição ${prescription.id}`,
          result: 'SUCCESS',
          complianceFlags: {
            signedDocument: true,
          },
          metadata: {
            certificateIssuer: signatureResult.certificateInfo.issuer,
            certificateSubject: signatureResult.certificateInfo.subject,
          },
        }
      );

      return {
        success: true,
        message: 'Prescrição assinada com sucesso',
        signedAt: prescription.signedAt,
        certificateInfo: prescription.certificateInfo,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Erro ao assinar prescrição: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/verify-signature')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar assinatura digital da prescrição',
    description: 'Verifica a autenticidade da assinatura digital ICP-Brasil',
  })
  @ApiParam({ name: 'id', description: 'ID da prescrição' })
  @ApiResponse({
    status: 200,
    description: 'Resultado da verificação',
  })
  async verifySignature(@Param('id') id: string) {
    const prescription = await this.prescriptionService.getPrescriptionById(id);

    if (!prescription.isSigned || !prescription.digitalSignature) {
      throw new HttpException(
        'Prescrição não está assinada',
        HttpStatus.BAD_REQUEST
      );
    }

    // Preparar conteúdo do documento
    const documentContent = JSON.stringify({
      id: prescription.id,
      date: prescription.date.toISOString(),
      doctorId: prescription.doctorId,
      doctorLicense: prescription.doctorLicense,
      commerceId: prescription.commerceId,
      clientId: prescription.clientId,
      medications: prescription.medications,
    });

    // Verificar assinatura
    const verification = await this.digitalSignatureService.verifySignature(
      documentContent,
      prescription.digitalSignature
    );

    return {
      valid: verification.valid,
      certificateInfo: prescription.certificateInfo,
      timestamp: prescription.signedAt,
      errors: verification.errors,
    };
  }
}

