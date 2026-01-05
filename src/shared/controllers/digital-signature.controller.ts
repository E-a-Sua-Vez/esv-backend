import {
  Controller,
  Post,
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
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { AuthGuard } from '../../auth/auth.guard';
import { DigitalSignatureService } from '../services/digital-signature.service';

@ApiTags('digital-signature')
@Controller('digital-signature')
export class DigitalSignatureController {
  constructor(private readonly digitalSignatureService: DigitalSignatureService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/validate-certificate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar certificado digital ICP-Brasil',
    description: 'Valida um certificado digital ICP-Brasil antes de assinar',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        certificatePem: { type: 'string', description: 'Certificado em formato PEM' },
      },
      required: ['certificatePem'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado da validação do certificado',
  })
  async validateCertificate(@Body() body: { certificatePem: string }) {
    return this.digitalSignatureService.validateCertificate(body.certificatePem);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assinar documento com certificado digital ICP-Brasil',
    description: 'Assina um documento usando certificado digital ICP-Brasil (PKCS#7)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        documentContent: { type: 'string', description: 'Conteúdo do documento a assinar' },
        certificatePem: { type: 'string', description: 'Certificado em formato PEM' },
        privateKeyPem: { type: 'string', description: 'Chave privada em formato PEM' },
        password: { type: 'string', description: 'Senha do certificado (se necessário)' },
      },
      required: ['documentContent', 'certificatePem', 'privateKeyPem'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Documento assinado com sucesso',
  })
  async signDocument(
    @Body()
    body: {
      documentContent: string;
      certificatePem: string;
      privateKeyPem: string;
      password?: string;
    }
  ) {
    try {
      return await this.digitalSignatureService.signDocument(
        body.documentContent,
        body.certificatePem,
        body.privateKeyPem,
        body.password
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Erro ao assinar documento: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar assinatura digital',
    description: 'Verifica a autenticidade de uma assinatura digital ICP-Brasil',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        documentContent: { type: 'string', description: 'Conteúdo do documento' },
        signatureBase64: { type: 'string', description: 'Assinatura em Base64' },
        certificatePem: { type: 'string', description: 'Certificado (opcional)' },
      },
      required: ['documentContent', 'signatureBase64'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado da verificação',
  })
  async verifySignature(
    @Body()
    body: {
      documentContent: string;
      signatureBase64: string;
      certificatePem?: string;
    }
  ) {
    return this.digitalSignatureService.verifySignature(
      body.documentContent,
      body.signatureBase64,
      body.certificatePem
    );
  }
}











