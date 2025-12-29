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
import { MedicalReferenceService } from './medical-reference.service';
import { DigitalSignatureService } from '../shared/services/digital-signature.service';
import { AuditLogService } from '../shared/services/audit-log.service';
import { CrmValidationService } from '../shared/services/crm-validation.service';
import { getRepository } from 'fireorm';
import { publish } from 'ett-events-lib';
import { MedicalReference } from './model/medical-reference.entity';
import DocumentSigned from '../shared/events/DocumentSigned';

/**
 * Controlador para assinatura digital de referências médicas
 * Conformidade: CFM Resolução 1.821/2007
 */
@ApiTags('reference-signature')
@Controller('medical-reference')
export class ReferenceSignatureController {
  private referenceRepository = getRepository(MedicalReference);

  constructor(
    private readonly referenceService: MedicalReferenceService,
    private readonly digitalSignatureService: DigitalSignatureService,
    private readonly auditLogService: AuditLogService,
    private readonly crmValidationService: CrmValidationService
  ) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assinar referência médica com certificado digital ICP-Brasil',
    description: 'Assina uma referência médica usando certificado digital ICP-Brasil (PKCS#7). Após assinatura, o documento não pode ser alterado.',
  })
  @ApiParam({ name: 'id', description: 'ID da referência médica' })
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
    description: 'Referência médica assinada com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Referência já assinada ou certificado inválido',
  })
  async signReference(
    @Param('id') id: string,
    @Body() body: { certificatePem: string; privateKeyPem: string; password?: string },
    @User() user: any
  ) {
    try {
      const reference = await this.referenceService.getReferenceById(id);

      // Verificar se já está assinada
      if (reference.isSigned) {
        throw new HttpException(
          'Referência médica já está assinada e não pode ser alterada',
          HttpStatus.BAD_REQUEST
        );
      }

      // Preparar conteúdo do documento para assinatura
      const documentContent = JSON.stringify({
        id: reference.id,
        referenceDate: reference.referenceDate.toISOString(),
        doctorOriginId: reference.doctorOriginId,
        doctorDestinationId: reference.doctorDestinationId,
        specialtyDestination: reference.specialtyDestination,
        commerceId: reference.commerceId,
        clientId: reference.clientId,
        reason: reference.reason,
        presumptiveDiagnosis: reference.presumptiveDiagnosis,
      });

      // Assinar documento
      const signatureResult = await this.digitalSignatureService.signDocument(
        documentContent,
        body.certificatePem,
        body.privateKeyPem,
        body.password
      );

      // Atualizar referência com assinatura
      reference.digitalSignature = signatureResult.signature;
      reference.signedAt = signatureResult.timestamp;
      reference.signedBy = user.id || user.userId || user;
      reference.certificateInfo = signatureResult.certificateInfo;
      reference.isSigned = true;
      reference.updatedAt = new Date();
      reference.updatedBy = user.id || user.userId || user;

      await this.referenceRepository.update(reference);

      // Registrar auditoria
      await this.auditLogService.logAction(
        user.id || user.userId || user,
        'SIGN',
        'reference',
        reference.id,
        {
          userName: user.name || user.email,
          userEmail: user.email,
          entityName: `Referência Médica ${reference.id}`,
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
        message: 'Referência médica assinada com sucesso',
        signedAt: reference.signedAt,
        certificateInfo: reference.certificateInfo,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Erro ao assinar referência médica: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/verify-signature')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar assinatura digital da referência médica',
    description: 'Verifica a autenticidade da assinatura digital ICP-Brasil',
  })
  @ApiParam({ name: 'id', description: 'ID da referência médica' })
  @ApiResponse({
    status: 200,
    description: 'Resultado da verificação',
  })
  async verifySignature(@Param('id') id: string) {
    const reference = await this.referenceService.getReferenceById(id);

    if (!reference.isSigned || !reference.digitalSignature) {
      throw new HttpException(
        'Referência médica não está assinada',
        HttpStatus.BAD_REQUEST
      );
    }

    // Preparar conteúdo do documento
    const documentContent = JSON.stringify({
      id: reference.id,
      referenceDate: reference.referenceDate.toISOString(),
      doctorOriginId: reference.doctorOriginId,
      doctorDestinationId: reference.doctorDestinationId,
      specialtyDestination: reference.specialtyDestination,
      commerceId: reference.commerceId,
      clientId: reference.clientId,
      reason: reference.reason,
      presumptiveDiagnosis: reference.presumptiveDiagnosis,
    });

    // Verificar assinatura
    const verification = await this.digitalSignatureService.verifySignature(
      documentContent,
      reference.digitalSignature
    );

    return {
      valid: verification.valid,
      certificateInfo: reference.certificateInfo,
      timestamp: reference.signedAt,
      errors: verification.errors,
    };
  }
}

