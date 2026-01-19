import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { IncomeService } from '../income/income.service';
import { OutcomeService } from '../outcome/outcome.service';
import { OutcomeStatus } from '../outcome/model/outcome-status.enum';
import { PaymentMethod } from '../payment/model/payment-method.enum';

import ProfessionalCommissionPaymentCreated from './events/ProfessionalCommissionPaymentCreated';
import ProfessionalCommissionPaymentUpdated from './events/ProfessionalCommissionPaymentUpdated';
import ProfessionalCommissionPaymentPaid from './events/ProfessionalCommissionPaymentPaid';
import ProfessionalCommissionPaymentCancelled from './events/ProfessionalCommissionPaymentCancelled';
import { ProfessionalCommissionPayment } from './model/professional-commission-payment.entity';
import { CommissionPaymentStatus } from './model/commission-payment-status.enum';

@Injectable()
export class ProfessionalCommissionPaymentService {
  private readonly logger = new Logger(ProfessionalCommissionPaymentService.name);

  constructor(
    @InjectRepository(ProfessionalCommissionPayment)
    private commissionPaymentRepository = getRepository(ProfessionalCommissionPayment),
    private incomeService: IncomeService,
    private outcomeService: OutcomeService
  ) {}

  public async getCommissionPaymentById(id: string): Promise<ProfessionalCommissionPayment> {
    return await this.commissionPaymentRepository.findById(id);
  }

  public async getCommissionPaymentsByCommerce(
    commerceId: string
  ): Promise<ProfessionalCommissionPayment[]> {
    return await this.commissionPaymentRepository.whereEqualTo('commerceId', commerceId).find();
  }

  public async getCommissionPaymentsByProfessional(
    professionalId: string
  ): Promise<ProfessionalCommissionPayment[]> {
    return await this.commissionPaymentRepository
      .whereEqualTo('professionalId', professionalId)
      .find();
  }

  public async getCommissionPaymentsByStatus(
    commerceId: string,
    status: CommissionPaymentStatus
  ): Promise<ProfessionalCommissionPayment[]> {
    return await this.commissionPaymentRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('status', status)
      .find();
  }

  /**
   * Obtener incomes pendientes de pago para un profesional
   */
  public async getUnpaidIncomesByProfessional(
    professionalId: string,
    commerceId: string,
    from?: Date,
    to?: Date
  ) {
    try {
      return await this.incomeService.getUnpaidIncomesByProfessional(
        professionalId,
        commerceId,
        from,
        to
      );
    } catch (error) {
      this.logger.error(`Error getting unpaid incomes: ${error.message}`, error.stack);
      throw new HttpException(
        `Error al obtener atenciones pendientes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Crear un nuevo pago de comisiones
   */
  public async createCommissionPayment(
    user: string,
    commerceId: string,
    businessId: string,
    professionalId: string,
    incomeIds: string[],
    periodFrom: Date,
    periodTo: Date,
    notes?: string
  ): Promise<ProfessionalCommissionPayment> {
    try {
      // Validar que los incomes existen y están disponibles
      const incomes = await this.incomeService.getIncomesById(incomeIds);

      if (incomes.length !== incomeIds.length) {
        throw new HttpException(
          'Algunos ingresos no fueron encontrados',
          HttpStatus.BAD_REQUEST
        );
      }

      // Validar que todos los incomes tienen commissionPaid = false
      const alreadyPaid = incomes.filter(income => income.commissionPaid);
      if (alreadyPaid.length > 0) {
        throw new HttpException(
          `Algunos ingresos ya tienen comisión pagada: ${alreadyPaid.map(i => i.id).join(', ')}`,
          HttpStatus.BAD_REQUEST
        );
      }

      // Validar que todos pertenecen al mismo profesional
      const differentProfessional = incomes.filter(income => income.professionalId !== professionalId);
      if (differentProfessional.length > 0) {
        throw new HttpException(
          'Todos los ingresos deben pertenecer al mismo profesional',
          HttpStatus.BAD_REQUEST
        );
      }

      // Calcular totales
      const totalIncomes = incomes.length;
      const totalAmount = incomes.reduce((sum, income) => sum + (income.amount || 0), 0);
      const totalCommission = incomes.reduce((sum, income) => sum + (income.professionalCommission || 0), 0);

      // Crear el pago
      const commissionPayment = new ProfessionalCommissionPayment();
      commissionPayment.commerceId = commerceId;
      commissionPayment.businessId = businessId;
      commissionPayment.professionalId = professionalId;
      commissionPayment.incomeIds = incomeIds;
      commissionPayment.totalIncomes = totalIncomes;
      commissionPayment.totalAmount = totalAmount;
      commissionPayment.totalCommission = totalCommission;
      commissionPayment.periodFrom = periodFrom;
      commissionPayment.periodTo = periodTo;
      commissionPayment.status = CommissionPaymentStatus.CREATED;
      commissionPayment.createdAt = new Date();
      commissionPayment.createdBy = user;
      commissionPayment.notes = notes || '';

      const created = await this.commissionPaymentRepository.create(commissionPayment);

      // Marcar incomes como commissionPaid = true
      for (const income of incomes) {
        income.commissionPaid = true;
        income.commissionPaymentId = created.id;
        await this.incomeService.updateIncome(user, income);
      }

      // Publicar evento
      const event = new ProfessionalCommissionPaymentCreated(new Date(), created, { user });
      publish(event);

      this.logger.log(`Commission payment created: ${created.id}`);
      return created;
    } catch (error) {
      this.logger.error(`Error creating commission payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Actualizar un pago de comisiones (solo si status = CREATED)
   */
  public async updateCommissionPayment(
    user: string,
    id: string,
    incomeIdsToAdd?: string[],
    incomeIdsToRemove?: string[],
    notes?: string
  ): Promise<ProfessionalCommissionPayment> {
    try {
      const payment = await this.commissionPaymentRepository.findById(id);

      if (!payment) {
        throw new HttpException('Pago de comisiones no encontrado', HttpStatus.NOT_FOUND);
      }

      if (payment.status !== CommissionPaymentStatus.CREATED) {
        throw new HttpException(
          'Solo se pueden editar pagos en estado CREATED',
          HttpStatus.BAD_REQUEST
        );
      }

      // Remover incomes
      if (incomeIdsToRemove && incomeIdsToRemove.length > 0) {
        const incomesToRemove = await this.incomeService.getIncomesById(incomeIdsToRemove);
        for (const income of incomesToRemove) {
          income.commissionPaid = false;
          income.commissionPaymentId = null;
          await this.incomeService.updateIncome(user, income);
        }
        payment.incomeIds = payment.incomeIds.filter(id => !incomeIdsToRemove.includes(id));
      }

      // Añadir incomes
      if (incomeIdsToAdd && incomeIdsToAdd.length > 0) {
        const incomesToAdd = await this.incomeService.getIncomesById(incomeIdsToAdd);

        // Validar disponibilidad
        const alreadyPaid = incomesToAdd.filter(income => income.commissionPaid);
        if (alreadyPaid.length > 0) {
          throw new HttpException(
            `Algunos ingresos ya tienen comisión pagada`,
            HttpStatus.BAD_REQUEST
          );
        }

        // Validar profesional
        const differentProfessional = incomesToAdd.filter(
          income => income.professionalId !== payment.professionalId
        );
        if (differentProfessional.length > 0) {
          throw new HttpException(
            'Los ingresos deben pertenecer al mismo profesional',
            HttpStatus.BAD_REQUEST
          );
        }

        for (const income of incomesToAdd) {
          income.commissionPaid = true;
          income.commissionPaymentId = payment.id;
          await this.incomeService.updateIncome(user, income);
        }

        payment.incomeIds = [...payment.incomeIds, ...incomeIdsToAdd];
      }

      // Actualizar notas
      if (notes !== undefined) {
        payment.notes = notes;
      }

      // Recalcular totales
      const allIncomes = await this.incomeService.getIncomesById(payment.incomeIds);
      payment.totalIncomes = allIncomes.length;
      payment.totalAmount = allIncomes.reduce((sum, income) => sum + (income.amount || 0), 0);
      payment.totalCommission = allIncomes.reduce((sum, income) => sum + (income.professionalCommission || 0), 0);
      payment.updatedAt = new Date();
      payment.updatedBy = user;

      const updated = await this.commissionPaymentRepository.update(payment);

      // Publicar evento
      const event = new ProfessionalCommissionPaymentUpdated(new Date(), updated, { user });
      publish(event);

      this.logger.log(`Commission payment updated: ${updated.id}`);
      return updated;
    } catch (error) {
      this.logger.error(`Error updating commission payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Confirmar pago (crea outcome automático)
   */
  public async confirmCommissionPayment(
    user: string,
    id: string,
    paymentMethod: PaymentMethod,
    paymentNotes?: string
  ): Promise<ProfessionalCommissionPayment> {
    try {
      const payment = await this.commissionPaymentRepository.findById(id);

      if (!payment) {
        throw new HttpException('Pago de comisiones no encontrado', HttpStatus.NOT_FOUND);
      }

      if (payment.status !== CommissionPaymentStatus.CREATED) {
        throw new HttpException(
          'Solo se pueden confirmar pagos en estado CREATED',
          HttpStatus.BAD_REQUEST
        );
      }

      // Crear outcome automático
      const outcome = await this.outcomeService.createOutcome(
        user,
        payment.commerceId,
        'PROFESSIONAL_COMMISSION',
        OutcomeStatus.CONFIRMED,
        null, // bookingId
        null, // attentionId
        null, // clientId
        null, // packageId
        payment.totalCommission,
        payment.totalCommission,
        1, // installments
        paymentMethod,
        0, // commission
        '', // comment
        '', // fiscalNote
        '', // promotionalCode
        '', // transactionId
        '', // bankEntity
        { user }, // outcomeInfo
        '', // paymentType
        payment.totalCommission.toString(), // paymentAmount
        '', // quantity
        `Pago de comisiones - Profesional ${payment.professionalId}`, // title
        '', // productId
        '', // productName
        payment.professionalId, // beneficiary
        '', // companyBeneficiaryId
        new Date(), // date
        payment.id, // code (referencia al commission payment)
        null // expireDate
      );

      // Actualizar payment
      payment.status = CommissionPaymentStatus.PAID;
      payment.paidAt = new Date();
      payment.paidBy = user;
      payment.paymentMethod = paymentMethod;
      payment.paymentNotes = paymentNotes || '';
      payment.outcomeId = outcome.id;
      payment.updatedAt = new Date();
      payment.updatedBy = user;

      const updated = await this.commissionPaymentRepository.update(payment);

      // Publicar evento
      const event = new ProfessionalCommissionPaymentPaid(new Date(), updated, { user });
      publish(event);

      this.logger.log(`Commission payment confirmed: ${updated.id}`);
      return updated;
    } catch (error) {
      this.logger.error(`Error confirming commission payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Cancelar pago (revierte incomes)
   */
  public async cancelCommissionPayment(
    user: string,
    id: string,
    reason: string
  ): Promise<ProfessionalCommissionPayment> {
    try {
      const payment = await this.commissionPaymentRepository.findById(id);

      if (!payment) {
        throw new HttpException('Pago de comisiones no encontrado', HttpStatus.NOT_FOUND);
      }

      if (payment.status === CommissionPaymentStatus.CANCELLED) {
        throw new HttpException('El pago ya está cancelado', HttpStatus.BAD_REQUEST);
      }

      // Revertir incomes
      const incomes = await this.incomeService.getIncomesById(payment.incomeIds);
      for (const income of incomes) {
        income.commissionPaid = false;
        income.commissionPaymentId = null;
        await this.incomeService.updateIncome(user, income);
      }

      // Actualizar payment
      payment.status = CommissionPaymentStatus.CANCELLED;
      payment.cancelledAt = new Date();
      payment.cancelledBy = user;
      payment.cancellationReason = reason;
      payment.updatedAt = new Date();
      payment.updatedBy = user;

      const updated = await this.commissionPaymentRepository.update(payment);

      // Publicar evento
      const event = new ProfessionalCommissionPaymentCancelled(new Date(), updated, { user });
      publish(event);

      this.logger.log(`Commission payment cancelled: ${updated.id}`);
      return updated;
    } catch (error) {
      this.logger.error(`Error cancelling commission payment: ${error.message}`, error.stack);
      throw error;
    }
  }
}
