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
import { MedicalExamOrderService } from './medical-exam-order.service';
import { DigitalSignatureService } from '../shared/services/digital-signature.service';
import { AuditLogService } from '../shared/services/audit-log.service';
import { CrmValidationService } from '../shared/services/crm-validation.service';
import { getRepository } from 'fireorm';
import { publish } from 'ett-events-lib';
import { MedicalExamOrder } from './model/medical-exam-order.entity';
import DocumentSigned from '../shared/events/DocumentSigned';

/**
 * Controlador para assinatura digital de ordens de exame
 * Conformidade: CFM Resolução 1.821/2007
 */
@ApiTags('exam-order-signature')
@Controller('medical-exam-order')
export class ExamOrderSignatureController {
  private examOrderRepository = getRepository(MedicalExamOrder);

  constructor(
    private readonly examOrderService: MedicalExamOrderService,
    private readonly digitalSignatureService: DigitalSignatureService,
    private readonly auditLogService: AuditLogService,
    private readonly crmValidationService: CrmValidationService
  ) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assinar ordem de exame com certificado digital ICP-Brasil',
    description: 'Assina uma ordem de exame usando certificado digital ICP-Brasil (PKCS#7). Após assinatura, o documento não pode ser alterado.',
  })
  @ApiParam({ name: 'id', description: 'ID da ordem de exame' })
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
    description: 'Ordem de exame assinada com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Ordem já assinada ou certificado inválido',
  })
  async signExamOrder(
    @Param('id') id: string,
    @Body() body: { certificatePem: string; privateKeyPem: string; password?: string },
    @User() user: any
  ) {
    try {
      const examOrder = await this.examOrderService.getExamOrderById(id);

      // Verificar se já está assinada
      if (examOrder.isSigned) {
        throw new HttpException(
          'Ordem de exame já está assinada e não pode ser alterada',
          HttpStatus.BAD_REQUEST
        );
      }

      // Validar CRM se disponível (do médico)
      // Nota: ExamOrder pode não ter CRM diretamente, mas pode ter doctorId
      // A validação pode ser feita através do collaborator associado

      // Preparar conteúdo do documento para assinatura
      const documentContent = JSON.stringify({
        id: examOrder.id,
        requestedAt: examOrder.requestedAt.toISOString(),
        doctorId: examOrder.doctorId,
        commerceId: examOrder.commerceId,
        clientId: examOrder.clientId,
        exams: examOrder.exams,
        clinicalJustification: examOrder.clinicalJustification,
      });

      // Assinar documento
      const signatureResult = await this.digitalSignatureService.signDocument(
        documentContent,
        body.certificatePem,
        body.privateKeyPem,
        body.password
      );

      // Atualizar ordem com assinatura
      examOrder.digitalSignature = signatureResult.signature;
      examOrder.signedAt = signatureResult.timestamp;
      examOrder.signedBy = user.id || user.userId || user;
      examOrder.certificateInfo = signatureResult.certificateInfo;
      examOrder.isSigned = true;
      examOrder.updatedAt = new Date();
      examOrder.updatedBy = user.id || user.userId || user;

      await this.examOrderRepository.update(examOrder);

      // Publicar evento
      const event = new DocumentSigned(new Date(), {
        documentId: examOrder.id,
        documentType: 'exam_order',
        signedBy: examOrder.signedBy,
        signedAt: examOrder.signedAt,
        certificateInfo: examOrder.certificateInfo,
      }, { user: user.id || user.userId || user });
      publish(event);

      // Registrar auditoria
      await this.auditLogService.logAction(
        user.id || user.userId || user,
        'SIGN',
        'exam_order',
        examOrder.id,
        {
          userName: user.name || user.email,
          userEmail: user.email,
          entityName: `Ordem de Exame ${examOrder.id}`,
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
        message: 'Ordem de exame assinada com sucesso',
        signedAt: examOrder.signedAt,
        certificateInfo: examOrder.certificateInfo,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Erro ao assinar ordem de exame: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/verify-signature')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar assinatura digital da ordem de exame',
    description: 'Verifica a autenticidade da assinatura digital ICP-Brasil',
  })
  @ApiParam({ name: 'id', description: 'ID da ordem de exame' })
  @ApiResponse({
    status: 200,
    description: 'Resultado da verificação',
  })
  async verifySignature(@Param('id') id: string) {
    const examOrder = await this.examOrderService.getExamOrderById(id);

    if (!examOrder.isSigned || !examOrder.digitalSignature) {
      throw new HttpException(
        'Ordem de exame não está assinada',
        HttpStatus.BAD_REQUEST
      );
    }

    // Preparar conteúdo do documento
    const documentContent = JSON.stringify({
      id: examOrder.id,
      requestedAt: examOrder.requestedAt.toISOString(),
      doctorId: examOrder.doctorId,
      commerceId: examOrder.commerceId,
      clientId: examOrder.clientId,
      exams: examOrder.exams,
      clinicalJustification: examOrder.clinicalJustification,
    });

    // Verificar assinatura
    const verification = await this.digitalSignatureService.verifySignature(
      documentContent,
      examOrder.digitalSignature
    );

    return {
      valid: verification.valid,
      certificateInfo: examOrder.certificateInfo,
      timestamp: examOrder.signedAt,
      errors: verification.errors,
    };
  }
}

