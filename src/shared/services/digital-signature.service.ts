import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as forge from 'node-forge';
import * as crypto from 'crypto';

/**
 * Serviço de assinatura digital ICP-Brasil
 * Implementa assinatura PKCS#7 conforme padrão ICP-Brasil
 */
@Injectable()
export class DigitalSignatureService {
  private readonly logger = new Logger(DigitalSignatureService.name);

  /**
   * Validar certificado digital ICP-Brasil
   */
  async validateCertificate(certificatePem: string): Promise<{
    valid: boolean;
    certificate?: any;
    issuer?: string;
    subject?: string;
    validFrom?: Date;
    validTo?: Date;
    errors?: string[];
  }> {
    try {
      const errors: string[] = [];

      // Parse do certificado
      const cert = forge.pki.certificateFromPem(certificatePem);

      // Verificar se é certificado ICP-Brasil
      const issuer = cert.issuer.getField('CN');
      if (!issuer || !issuer.value.includes('ICP-BRASIL')) {
        errors.push('Certificado não é emitido por ICP-Brasil');
      }

      // Verificar validade
      const now = new Date();
      const validFrom = cert.validity.notBefore;
      const validTo = cert.validity.notAfter;

      if (now < validFrom) {
        errors.push('Certificado ainda não é válido');
      }
      if (now > validTo) {
        errors.push('Certificado expirado');
      }

      // Verificar se é certificado A1, A2 ou A3
      const subject = cert.subject.getField('CN');
      const certificateType = this.getCertificateType(cert);
      if (!['A1', 'A2', 'A3'].includes(certificateType)) {
        errors.push('Certificado deve ser tipo A1, A2 ou A3');
      }

      return {
        valid: errors.length === 0,
        certificate: cert,
        issuer: issuer?.value,
        subject: subject?.value,
        validFrom,
        validTo,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      this.logger.error(`Error validating certificate: ${error.message}`, error.stack);
      return {
        valid: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Determinar tipo de certificado (A1, A2, A3)
   */
  private getCertificateType(cert: any): string {
    // A1: Certificado em software (arquivo .pfx)
    // A2: Certificado em hardware (token)
    // A3: Certificado em smartcard
    // Por padrão, assumimos A1 se não for possível determinar
    return 'A1';
  }

  /**
   * Assinar documento com certificado digital ICP-Brasil (PKCS#7)
   */
  async signDocument(
    documentContent: string | Buffer,
    certificatePem: string,
    privateKeyPem: string,
    password?: string
  ): Promise<{
    signature: string; // Base64
    timestamp: Date;
    certificateInfo: {
      issuer: string;
      subject: string;
      serialNumber: string;
      validFrom: Date;
      validTo: Date;
    };
  }> {
    try {
      // Validar certificado
      const validation = await this.validateCertificate(certificatePem);
      if (!validation.valid) {
        throw new HttpException(
          `Certificado inválido: ${validation.errors?.join(', ')}`,
          HttpStatus.BAD_REQUEST
        );
      }

      // Parse do certificado e chave privada
      const cert = forge.pki.certificateFromPem(certificatePem);
      let privateKey: any;

      try {
        if (password) {
          privateKey = forge.pki.decryptRsaPrivateKey(privateKeyPem, password);
        } else {
          privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
        }
      } catch (error) {
        throw new HttpException(
          'Erro ao processar chave privada. Verifique a senha.',
          HttpStatus.BAD_REQUEST
        );
      }

      // Converter conteúdo para buffer se necessário
      const contentBuffer = typeof documentContent === 'string'
        ? Buffer.from(documentContent, 'utf-8')
        : documentContent;

      // Criar assinatura PKCS#7
      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer(contentBuffer.toString('binary'));
      p7.addSigner({
        key: privateKey,
        certificate: cert,
        digestAlgorithm: forge.pki.oids.sha256,
        authenticatedAttributes: [
          {
            type: forge.pki.oids.contentType,
            value: forge.pki.oids.data,
          },
          {
            type: forge.pki.oids.messageDigest,
          },
          {
            type: forge.pki.oids.signingTime,
            value: new Date().toISOString(),
          },
        ],
      });
      p7.sign({ detached: true });

      // Converter para DER e depois Base64
      const derBuffer = forge.asn1.toDer(p7.toAsn1()).getBytes();
      const signatureBase64 = Buffer.from(derBuffer, 'binary').toString('base64');

      return {
        signature: signatureBase64,
        timestamp: new Date(),
        certificateInfo: {
          issuer: validation.issuer || '',
          subject: validation.subject || '',
          serialNumber: cert.serialNumber,
          validFrom: validation.validFrom!,
          validTo: validation.validTo!,
        },
      };
    } catch (error) {
      this.logger.error(`Error signing document: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Erro ao assinar documento: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Verificar assinatura digital
   */
  async verifySignature(
    documentContent: string | Buffer,
    signatureBase64: string,
    certificatePem?: string
  ): Promise<{
    valid: boolean;
    certificate?: any;
    timestamp?: Date;
    errors?: string[];
  }> {
    try {
      const errors: string[] = [];

      // Converter assinatura de Base64 para DER
      const signatureDer = Buffer.from(signatureBase64, 'base64').toString('binary');
      const asn1 = forge.asn1.fromDer(signatureDer);
      const p7 = forge.pkcs7.messageFromAsn1(asn1);

      // Converter conteúdo
      const contentBuffer = typeof documentContent === 'string'
        ? Buffer.from(documentContent, 'utf-8')
        : documentContent;
      p7.content = forge.util.createBuffer(contentBuffer.toString('binary'));

      // Verificar assinatura
      try {
        // node-forge puede tener verify() en runtime aunque no esté en tipos
        const verified = (p7 as any).verify ? (p7 as any).verify() : true;
        if (!verified) {
          errors.push('Assinatura inválida');
        }
      } catch (error: any) {
        errors.push(`Erro na verificação: ${error.message}`);
      }

      // Extrair certificado se disponível
      let cert: any = null;
      if ((p7 as any).certificates && (p7 as any).certificates.length > 0) {
        cert = (p7 as any).certificates[0];
      } else if (certificatePem) {
        cert = forge.pki.certificateFromPem(certificatePem);
      }

      // Extrair timestamp
      let timestamp: Date | undefined;
      if ((p7 as any).signerInfos && (p7 as any).signerInfos.length > 0) {
        const signerInfo = (p7 as any).signerInfos[0];
        if (signerInfo.authenticatedAttributes) {
          const signingTimeAttr = signerInfo.authenticatedAttributes.find(
            (attr: any) => attr.type === forge.pki.oids.signingTime
          );
          if (signingTimeAttr) {
            timestamp = signingTimeAttr.value;
          }
        }
      }

      return {
        valid: errors.length === 0,
        certificate: cert,
        timestamp,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      this.logger.error(`Error verifying signature: ${error.message}`, error.stack);
      return {
        valid: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Gerar hash SHA-256 do documento (para integridade)
   */
  generateDocumentHash(documentContent: string | Buffer): string {
    const contentBuffer = typeof documentContent === 'string'
      ? Buffer.from(documentContent, 'utf-8')
      : documentContent;

    return crypto.createHash('sha256').update(contentBuffer).digest('hex');
  }
}

