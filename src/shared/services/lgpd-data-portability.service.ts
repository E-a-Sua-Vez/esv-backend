import { Injectable, Logger, HttpException, HttpStatus, Inject, Optional } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';
import * as crypto from 'crypto';

import { Client } from '../../client/model/client.entity';
import { Attention } from '../../attention/model/attention.entity';
import { Prescription } from '../../prescription/model/prescription.entity';
import { MedicalExamOrder } from '../../medical-exam-order/model/medical-exam-order.entity';
import { MedicalReference } from '../../medical-reference/model/medical-reference.entity';
import { PatientHistory } from '../../patient-history/model/patient-history.entity';
import { LgpdConsent } from '../model/lgpd-consent.entity';
import { AuditLogService } from './audit-log.service';
import { LgpdConsentService } from './lgpd-consent.service';
import DataPortabilityRequested from '../events/DataPortabilityRequested';
import { LgpdNotificationService } from './lgpd-notification.service';

/**
 * Serviço de portabilidade de dados LGPD
 * Conformidade: LGPD (Lei 13.709/2018) - Artigo 18, inciso V
 * Permite ao titular dos dados solicitar a portabilidade de seus dados
 */
@Injectable()
export class LgpdDataPortabilityService {
  private readonly logger = new Logger(LgpdDataPortabilityService.name);

  constructor(
    @InjectRepository(Client)
    private clientRepository = getRepository(Client),
    @InjectRepository(Attention)
    private attentionRepository = getRepository(Attention),
    @InjectRepository(Prescription)
    private prescriptionRepository = getRepository(Prescription),
    @InjectRepository(MedicalExamOrder)
    private examOrderRepository = getRepository(MedicalExamOrder),
    @InjectRepository(MedicalReference)
    private referenceRepository = getRepository(MedicalReference),
    @InjectRepository(PatientHistory)
    private patientHistoryRepository = getRepository(PatientHistory),
    @InjectRepository(LgpdConsent)
    private consentRepository = getRepository(LgpdConsent),
    @Inject(LgpdConsentService)
    private lgpdConsentService: LgpdConsentService,
    @Optional() @Inject(AuditLogService)
    private auditLogService?: AuditLogService,
    @Optional() @Inject(LgpdNotificationService)
    private lgpdNotificationService?: LgpdNotificationService
  ) {}

  /**
   * Gerar arquivo de portabilidade de dados
   * Retorna um ZIP com todos os dados do paciente em formato estruturado (JSON)
   */
  async generateDataPortabilityFile(
    user: string,
    commerceId: string,
    clientId: string
  ): Promise<{ fileUrl: string; fileName: string; expiresAt: Date; fileHash: string; fileSize: number }> {
    try {
      // Verificar consentimento para exportação de dados
      const hasConsent = await this.lgpdConsentService.hasActiveConsent(
        commerceId,
        clientId,
        'DATA_EXPORT' as any
      );

      if (!hasConsent) {
        throw new HttpException(
          'Cliente não possui consentimento ativo para exportação de dados',
          HttpStatus.FORBIDDEN
        );
      }

      // Coletar todos os dados do paciente
      const client = await this.clientRepository.findById(clientId);
      if (!client) {
        throw new HttpException('Cliente não encontrado', HttpStatus.NOT_FOUND);
      }

      const dataPackage = {
        metadata: {
          generatedAt: new Date().toISOString(),
          generatedBy: user,
          clientId,
          commerceId,
          version: '1.0',
          format: 'LGPD_DATA_PORTABILITY',
        },
        personalData: {
          id: client.id,
          name: client.name,
          lastName: client.lastName,
          email: client.email,
          phone: client.phone,
          idNumber: client.idNumber,
          birthDate: (client as any).birthDate,
          gender: (client as any).gender,
          address: (client as any).address,
          // Não incluir dados sensíveis sem necessidade
        },
        medicalData: {
          attentions: [],
          prescriptions: [],
          examOrders: [],
          references: [],
          patientHistory: null,
        },
        consents: [],
        auditLog: [],
      };

      // Coletar atenções
      const attentions = await this.attentionRepository
        .whereEqualTo('commerceId', commerceId)
        .whereEqualTo('clientId', clientId)
        .orderByDescending('createdAt')
        .find();

      dataPackage.medicalData.attentions = attentions.map(att => ({
        id: att.id,
        date: att.createdAt || (att as any).date,
        type: att.type,
        status: att.status,
        notes: (att as any).notes || att.comment || '',
        // Não incluir dados sensíveis desnecessários
      }));

      // Coletar prescrições
      const prescriptions = await this.prescriptionRepository
        .whereEqualTo('commerceId', commerceId)
        .whereEqualTo('clientId', clientId)
        .orderByDescending('createdAt')
        .find();

      dataPackage.medicalData.prescriptions = prescriptions.map(pres => ({
        id: pres.id,
        date: pres.date,
        validUntil: pres.validUntil,
        status: pres.status,
        medications: pres.medications,
        observations: pres.observations,
        instructions: pres.instructions,
        pdfUrl: pres.pdfUrl,
        documentHash: pres.documentHash,
        isSigned: pres.isSigned,
        signedAt: pres.signedAt,
      }));

      // Coletar ordens de exame
      const examOrders = await this.examOrderRepository
        .whereEqualTo('commerceId', commerceId)
        .whereEqualTo('clientId', clientId)
        .orderByDescending('createdAt')
        .find();

      dataPackage.medicalData.examOrders = examOrders.map(order => ({
        id: order.id,
        requestedAt: order.requestedAt,
        type: order.type,
        priority: order.priority,
        status: order.status,
        exams: order.exams,
        clinicalJustification: order.clinicalJustification,
        results: order.results,
        pdfUrl: order.pdfUrl,
        documentHash: order.documentHash,
        isSigned: order.isSigned,
        signedAt: order.signedAt,
      }));

      // Coletar referências
      const references = await this.referenceRepository
        .whereEqualTo('commerceId', commerceId)
        .whereEqualTo('clientId', clientId)
        .orderByDescending('createdAt')
        .find();

      dataPackage.medicalData.references = references.map(ref => ({
        id: ref.id,
        referenceDate: ref.referenceDate,
        specialtyDestination: ref.specialtyDestination,
        reason: ref.reason,
        presumptiveDiagnosis: ref.presumptiveDiagnosis,
        status: ref.status,
        pdfUrl: ref.pdfUrl,
        documentHash: ref.documentHash,
        isSigned: ref.isSigned,
        signedAt: ref.signedAt,
      }));

      // Coletar histórico do paciente
      const patientHistory = await this.patientHistoryRepository
        .whereEqualTo('commerceId', commerceId)
        .whereEqualTo('clientId', clientId)
        .find();

      if (patientHistory.length > 0) {
        dataPackage.medicalData.patientHistory = patientHistory[0];
      }

      // Coletar consentimentos
      const consents = await this.consentRepository
        .whereEqualTo('commerceId', commerceId)
        .whereEqualTo('clientId', clientId)
        .orderByDescending('grantedAt')
        .find();

      dataPackage.consents = consents.map(consent => ({
        id: consent.id,
        consentType: consent.consentType,
        status: consent.status,
        purpose: consent.purpose,
        grantedAt: consent.grantedAt,
        expiresAt: consent.expiresAt,
        revokedAt: consent.revokedAt,
      }));

      // Coletar logs de auditoria relacionados
      if (this.auditLogService) {
        const auditLogs = await this.auditLogService.getLogsByEntity('client', clientId, 1000);
        dataPackage.auditLog = auditLogs.map(log => ({
          timestamp: log.timestamp,
          action: log.action,
          entityType: log.entityType,
          result: log.result,
          // Não incluir IP e user agent por privacidade
        }));
      }

      // Criar arquivo JSON
      const jsonContent = JSON.stringify(dataPackage, null, 2);
      const jsonBuffer = Buffer.from(jsonContent, 'utf-8');

      // Por enquanto, retornar JSON diretamente
      // Em produção, pode ser comprimido em ZIP ou salvo em S3
      // TODO: Implementar compressão ZIP ou upload para S3

      // Upload para S3 (similar ao PDF)
      // Por enquanto, retornar como base64 ou salvar temporariamente
      // TODO: Implementar upload para S3

      const fileName = `portabilidade-dados-${clientId}-${new Date().toISOString().split('T')[0]}.json`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Válido por 7 dias

      // Gerar hash do arquivo para verificação de integridade
      const fileHash = crypto.createHash('sha256').update(jsonBuffer).digest('hex');

      // Publicar evento
      const event = new DataPortabilityRequested(new Date(), {
        clientId,
        commerceId,
        fileName,
        fileHash,
        fileSize: jsonBuffer.length,
      }, { user });
      publish(event);

      // Notificar al titular que la portabilidad está lista
      const fileUrl = `data:application/json;base64,${jsonBuffer.toString('base64')}`;
      if (this.lgpdNotificationService) {
        await this.lgpdNotificationService.notifyDataPortabilityReady(
          clientId,
          commerceId,
          fileName,
          fileUrl
        );
      }

      // Registrar auditoria
      if (this.auditLogService) {
        await this.auditLogService.logAction(
          user,
          'EXPORT',
          'client',
          clientId,
          {
            entityName: `Portabilidade de Dados - ${client.name}`,
            result: 'SUCCESS',
            complianceFlags: {
              dataExport: true,
              lgpdConsent: true,
            },
            metadata: {
              fileName,
              fileHash,
              expiresAt: expiresAt.toISOString(),
            },
          }
        );
      }

      // Por enquanto, retornar JSON como base64
      // Em produção, fazer upload para S3 e retornar URL assinada
      return {
        fileUrl: `data:application/json;base64,${jsonBuffer.toString('base64')}`,
        fileName,
        expiresAt,
        fileHash,
        fileSize: jsonBuffer.length,
      };
    } catch (error) {
      this.logger.error(`Error generating data portability file: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Erro ao gerar arquivo de portabilidade: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Validar consentimento antes de processar dados
   */
  async validateConsentBeforeProcessing(
    commerceId: string,
    clientId: string,
    operation: string
  ): Promise<boolean> {
    // Verificar consentimento para processamento de dados
    return await this.lgpdConsentService.hasActiveConsent(
      commerceId,
      clientId,
      'DATA_PROCESSING' as any
    );
  }
}

