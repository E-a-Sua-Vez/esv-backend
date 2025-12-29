import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { Prescription } from '../../prescription/model/prescription.entity';
import { MedicalExamOrder } from '../../medical-exam-order/model/medical-exam-order.entity';
import { MedicalReference } from '../../medical-reference/model/medical-reference.entity';
import { PatientHistory } from '../../patient-history/model/patient-history.entity';
import { Attention } from '../../attention/model/attention.entity';
import { AuditLog } from '../model/audit-log.entity';

/**
 * Serviço de retenção automática de dados
 * Conformidade: CFM Resolução 1.821/2007 - Retenção mínima de 20 anos
 */
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);
  private readonly RETENTION_YEARS = 20;

  constructor(
    @InjectRepository(Prescription)
    private prescriptionRepository = getRepository(Prescription),
    @InjectRepository(MedicalExamOrder)
    private examOrderRepository = getRepository(MedicalExamOrder),
    @InjectRepository(MedicalReference)
    private referenceRepository = getRepository(MedicalReference),
    @InjectRepository(PatientHistory)
    private patientHistoryRepository = getRepository(PatientHistory),
    @InjectRepository(Attention)
    private attentionRepository = getRepository(Attention),
    @InjectRepository(AuditLog)
    private auditLogRepository = getRepository(AuditLog)
  ) {}

  /**
   * Verificar e arquivar documentos antigos
   * Executa diariamente às 2h (configurado via node-cron no main.ts ou módulo)
   */
  async archiveOldDocuments() {
    this.logger.log('Iniciando verificação de retenção de dados...');
    try {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - this.RETENTION_YEARS);

      // Arquivar prescrições antigas
      await this.archiveOldPrescriptions(cutoffDate);

      // Arquivar ordens de exame antigas
      await this.archiveOldExamOrders(cutoffDate);

      // Arquivar referências antigas
      await this.archiveOldReferences(cutoffDate);

      // Arquivar históricos de pacientes antigos
      await this.archiveOldPatientHistories(cutoffDate);

      // Arquivar atenções antigas
      await this.archiveOldAttentions(cutoffDate);

      this.logger.log('Verificação de retenção de dados concluída');
    } catch (error) {
      this.logger.error(`Erro na verificação de retenção: ${error.message}`, error.stack);
    }
  }

  /**
   * Arquivar prescrições antigas
   */
  private async archiveOldPrescriptions(cutoffDate: Date) {
    try {
      const oldPrescriptions = await this.prescriptionRepository
        .whereLessThan('createdAt', cutoffDate)
        .find();

      let archived = 0;
      for (const prescription of oldPrescriptions) {
        // Marcar como arquivado (não deletar, apenas marcar como não disponível)
        (prescription as any).available = false;
        await this.prescriptionRepository.update(prescription);
        archived++;
      }

      if (archived > 0) {
        this.logger.log(`Arquivadas ${archived} prescrições antigas`);
      }
    } catch (error) {
      this.logger.error(`Erro ao arquivar prescrições: ${error.message}`, error.stack);
    }
  }

  /**
   * Arquivar ordens de exame antigas
   */
  private async archiveOldExamOrders(cutoffDate: Date) {
    try {
      const oldOrders = await this.examOrderRepository
        .whereLessThan('createdAt', cutoffDate)
        .find();

      let archived = 0;
      for (const order of oldOrders) {
        (order as any).available = false;
        await this.examOrderRepository.update(order);
        archived++;
      }

      if (archived > 0) {
        this.logger.log(`Arquivadas ${archived} ordens de exame antigas`);
      }
    } catch (error) {
      this.logger.error(`Erro ao arquivar ordens de exame: ${error.message}`, error.stack);
    }
  }

  /**
   * Arquivar referências antigas
   */
  private async archiveOldReferences(cutoffDate: Date) {
    try {
      const oldReferences = await this.referenceRepository
        .whereLessThan('createdAt', cutoffDate)
        .find();

      let archived = 0;
      for (const reference of oldReferences) {
        (reference as any).available = false;
        await this.referenceRepository.update(reference);
        archived++;
      }

      if (archived > 0) {
        this.logger.log(`Arquivadas ${archived} referências antigas`);
      }
    } catch (error) {
      this.logger.error(`Erro ao arquivar referências: ${error.message}`, error.stack);
    }
  }

  /**
   * Arquivar históricos de pacientes antigos
   */
  private async archiveOldPatientHistories(cutoffDate: Date) {
    try {
      const oldHistories = await this.patientHistoryRepository
        .whereLessThan('createdAt', cutoffDate)
        .find();

      let archived = 0;
      for (const history of oldHistories) {
        (history as any).available = false;
        await this.patientHistoryRepository.update(history);
        archived++;
      }

      if (archived > 0) {
        this.logger.log(`Arquivados ${archived} históricos de pacientes antigos`);
      }
    } catch (error) {
      this.logger.error(`Erro ao arquivar históricos: ${error.message}`, error.stack);
    }
  }

  /**
   * Arquivar atenções antigas
   */
  private async archiveOldAttentions(cutoffDate: Date) {
    try {
      const oldAttentions = await this.attentionRepository
        .whereLessThan('createdAt', cutoffDate)
        .find();

      let archived = 0;
      for (const attention of oldAttentions) {
        // Marcar como arquivado usando campo disponible o comentario
        (attention as any).archived = true;
        (attention as any).archivedAt = new Date();
        await this.attentionRepository.update(attention);
        archived++;
      }

      if (archived > 0) {
        this.logger.log(`Arquivadas ${archived} atenções antigas`);
      }
    } catch (error) {
      this.logger.error(`Erro ao arquivar atenções: ${error.message}`, error.stack);
    }
  }

  /**
   * Verificar retenção manualmente (para testes ou execução sob demanda)
   */
  async checkRetentionManually(): Promise<{
    prescriptions: number;
    examOrders: number;
    references: number;
    patientHistories: number;
    attentions: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - this.RETENTION_YEARS);

    const [prescriptions, examOrders, references, patientHistories, attentions] =
      await Promise.all([
        this.prescriptionRepository
          .whereLessThan('createdAt', cutoffDate)
          .find(),
        this.examOrderRepository
          .whereLessThan('createdAt', cutoffDate)
          .find(),
        this.referenceRepository
          .whereLessThan('createdAt', cutoffDate)
          .find(),
        this.patientHistoryRepository
          .whereLessThan('createdAt', cutoffDate)
          .find(),
        this.attentionRepository
          .whereLessThan('createdAt', cutoffDate)
          .find(),
      ]);

    return {
      prescriptions: prescriptions.length,
      examOrders: examOrders.length,
      references: references.length,
      patientHistories: patientHistories.length,
      attentions: attentions.length,
    };
  }
}

