import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { PaymentConfirmation } from '../payment/model/payment-confirmation';
import { PaymentMethod } from '../payment/model/payment-method.enum';

import IncomeCreated from './events/IncomeCreated';
import IncomeUpdated from './events/IncomeUpdated';
import { IncomeStatus } from './model/income-status.enum';
import { IncomeType } from './model/income-type.enum';
import { Income, IncomeInfo } from './model/income.entity';

@Injectable()
export class IncomeService {
  constructor(
    @InjectRepository(Income)
    private incomeRepository = getRepository(Income)
  ) {}

  public async getIncomeById(id: string): Promise<Income> {
    const income = await this.incomeRepository.findById(id);
    return income;
  }

  public async getIncomes(): Promise<Income[]> {
    let incomes: Income[] = [];
    incomes = await this.incomeRepository.find();
    return incomes;
  }

  public async getIncomeByCommerce(commerceId: string): Promise<Income[]> {
    let incomes: Income[] = [];
    incomes = await this.incomeRepository.whereEqualTo('commerceId', commerceId).find();
    return incomes;
  }

  public async getPendingIncomeByPackage(commerceId: string, packageId: string): Promise<Income[]> {
    let incomes: Income[] = [];
    incomes = await this.incomeRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('packageId', packageId)
      .whereEqualTo('status', IncomeStatus.PENDING)
      .orderByAscending('installmentNumber')
      .find();
    return incomes;
  }

  public async getAllIncomesByPackage(commerceId: string, packageId: string): Promise<Income[]> {
    let incomes: Income[] = [];
    incomes = await this.incomeRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('packageId', packageId)
      .orderByAscending('createdAt')
      .find();
    return incomes;
  }

  public async getIncomesById(incomesId: string[]): Promise<Income[]> {
    let incomes: Income[] = [];
    incomes = await this.incomeRepository.whereIn('id', incomesId).find();
    return incomes;
  }

  public async getIncomesByAttentionId(attentionId: string): Promise<Income[]> {
    let incomes: Income[] = [];
    if (attentionId) {
      incomes = await this.incomeRepository.whereEqualTo('attentionId', attentionId).find();
    }
    return incomes;
  }

  public async getUnpaidIncomesByProfessional(
    professionalId: string,
    commerceId: string,
    from?: Date,
    to?: Date
  ): Promise<Income[]> {
    // Construir query base sin el filtro de commissionPaid
    // porque puede ser false, undefined o null, y FireORM whereEqualTo no maneja bien undefined
    let query = this.incomeRepository
      .whereEqualTo('professionalId', professionalId)
      .whereEqualTo('commerceId', commerceId);

    // Filtrar por fecha usando paidAt si existe, sino createdAt
    // Usar paidAt porque es la fecha real del pago, no la creación
    if (from) {
      query = query.whereGreaterOrEqualThan('paidAt', from);
    }
    if (to) {
      query = query.whereLessOrEqualThan('paidAt', to);
    }

    // Obtener todos los ingresos que cumplan los criterios
    let incomes = await query.find();

    // Filtrar en memoria:
    // 1. commissionPaid debe ser false, undefined o null (no true)
    // 2. Debe tener professionalCommission > 0
    // 3. Si no hay paidAt, usar createdAt como fallback para el filtro de fechas
    incomes = incomes.filter(income => {
      // Verificar que la comisión no esté pagada
      if (income.commissionPaid === true) {
        return false;
      }

      // Verificar que tenga comisión
      if (!income.professionalCommission || income.professionalCommission <= 0) {
        return false;
      }

      // Verificar fechas: usar paidAt si existe, sino createdAt
      const dateToCheck = income.paidAt || income.createdAt;
      if (from && dateToCheck < from) {
        return false;
      }
      if (to) {
        // Asegurar que incluya todo el día
        const toDateEnd = new Date(to);
        toDateEnd.setHours(23, 59, 59, 999);
        if (dateToCheck > toDateEnd) {
          return false;
        }
      }

      return true;
    });

    return incomes;
  }

  public async updateIncomeConfigurations(
    user: string,
    id: string,
    incomeInfo: IncomeInfo,
    paymentConfirmation: PaymentConfirmation,
    status: IncomeStatus
  ): Promise<Income> {
    try {
      const income = await this.incomeRepository.findById(id);
      if (incomeInfo !== undefined) {
        income.incomeInfo = incomeInfo;
      }
      if (paymentConfirmation !== undefined) {
        income.paymentConfirmation = paymentConfirmation;
      }
      if (status !== undefined) {
        income.status = status;
      }
      return await this.updateIncome(user, income);
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al modificar el income: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async updateIncome(userOrId: string, incomeOrUndefined?: Income): Promise<Income> {
    let income: Income;
    let user: string;

    // Soportar ambas firmas: updateIncome(user, income) y updateIncome(id, income) para retrocompatibilidad
    if (incomeOrUndefined) {
      user = userOrId;
      income = incomeOrUndefined;
    } else {
      // Si solo se pasa un argumento, es el id y income debe ser cargado
      const id = userOrId;
      income = await this.getIncomeById(id);
      user = 'system';
    }

    // Validar que no esté en un período cerrado
    if (income.isClosed) {
      throw new HttpException(
        'No se puede modificar un income de un período cerrado',
        HttpStatus.BAD_REQUEST
      );
    }

    const incomeUpdated = await await this.incomeRepository.update(income);
    const incomeUpdatedEvent = new IncomeUpdated(new Date(), incomeUpdated, { user });
    publish(incomeUpdatedEvent);
    return incomeUpdated;
  }

  public async createIncome(
    user: string,
    commerceId: string,
    type: IncomeType,
    status: IncomeStatus,
    bookingId: string,
    attentionId: string,
    clientId: string,
    packageId: string,
    amount: number,
    totalAmount: number,
    installments: number,
    paymentMethod: PaymentMethod,
    commission: number,
    comment: string,
    fiscalNote: string,
    promotionalCode: string,
    transactionId: string,
    bankEntity: string,
    incomeInfo: IncomeInfo,
    installmentNumber?: number,
    professionalId?: string,
    professionalCommission?: number,
    professionalName?: string,
    professionalCommissionType?: string,
    professionalCommissionValue?: number,
    professionalCommissionNotes?: string,
    servicesId?: string[],
    servicesDetails?: object[]
  ): Promise<Income> {
    const income = new Income();
    income.commerceId = commerceId;
    income.type = type || IncomeType.STANDARD;
    income.bookingId = bookingId;
    income.attentionId = attentionId;
    income.clientId = clientId;
    income.incomeInfo = incomeInfo;
    income.packageId = packageId;
    income.status = status || IncomeStatus.PENDING;
    income.amount = amount;
    income.totalAmount = totalAmount;
    income.installments = installments;
    income.paymentMethod = paymentMethod;
    income.commission = commission;
    income.comment = comment;
    income.fiscalNote = fiscalNote;
    income.promotionalCode = promotionalCode;
    income.transactionId = transactionId;
    income.bankEntity = bankEntity;
    income.professionalId = professionalId;
    income.professionalCommission = professionalCommission;
    income.professionalName = professionalName;
    income.professionalCommissionType = professionalCommissionType;
    income.professionalCommissionValue = professionalCommissionValue;
    income.professionalCommissionNotes = professionalCommissionNotes;
    income.servicesId = servicesId;
    income.servicesDetails = servicesDetails;
    if (status === IncomeStatus.CONFIRMED) {
      income.paid = true;
      income.paidAt = new Date();
      income.paidBy = user;
    }
    if (type === IncomeType.INSTALLMENT) {
      income.installmentNumber = installmentNumber;
    } else {
      income.installmentNumber = 0;
    }
    income.createdAt = new Date();
    income.createdBy = user;
    const incomeCreated = await this.incomeRepository.create(income);
    const incomeCreatedEvent = new IncomeCreated(new Date(), incomeCreated, { user });
    publish(incomeCreatedEvent);
    return incomeCreated;
  }

  public async createIncomes(
    user: string,
    commerceId: string,
    status: IncomeStatus,
    bookingId: string,
    attentionId: string,
    clientId: string,
    packageId: string,
    amount: number,
    totalAmount: number,
    installments: number,
    paymentMethod: PaymentMethod,
    commission: number,
    comment: string,
    fiscalNote: string,
    promotionalCode: string,
    transactionId: string,
    bankEntity: string,
    confirmInstallments: boolean,
    incomeInfo: IncomeInfo,
    professionalId?: string,
    professionalCommission?: number,
    professionalName?: string,
    professionalCommissionType?: string,
    professionalCommissionValue?: number,
    professionalCommissionNotes?: string,
    servicesId?: string[],
    servicesDetails?: object[]
  ): Promise<Income> {
    if (installments && installments > 1) {
      const firstIncome = await this.createIncome(
        user,
        commerceId,
        IncomeType.FIRST_PAYMENT,
        status,
        bookingId,
        attentionId,
        clientId,
        packageId,
        amount,
        totalAmount,
        installments,
        paymentMethod,
        commission,
        comment,
        fiscalNote,
        promotionalCode,
        transactionId,
        bankEntity,
        incomeInfo,
        undefined,
        professionalId,
        professionalCommission,
        professionalName,
        professionalCommissionType,
        professionalCommissionValue,
        professionalCommissionNotes,
        servicesId,
        servicesDetails
      );
      if (firstIncome && firstIncome.id) {
        let installmentAmount = 0;
        if (totalAmount && totalAmount > 0) {
          installmentAmount = (totalAmount - amount) / installments;
        }
        for (let i = 0; i < installments; i++) {
          let statusInstallments = IncomeStatus.PENDING;
          if (confirmInstallments && confirmInstallments === true) {
            statusInstallments = IncomeStatus.CONFIRMED;
          }
          const installmentNumber = i + 1;
          await this.createIncome(
            user,
            commerceId,
            IncomeType.INSTALLMENT,
            statusInstallments,
            bookingId,
            attentionId,
            clientId,
            packageId,
            installmentAmount,
            totalAmount,
            installments,
            paymentMethod,
            0,
            comment,
            fiscalNote,
            promotionalCode,
            transactionId,
            bankEntity,
            incomeInfo,
            installmentNumber,
            professionalId,
            professionalCommission,
            professionalName,
            professionalCommissionType,
            professionalCommissionValue,
            professionalCommissionNotes,
            servicesId,
            servicesDetails
          );
        }
      }
      return firstIncome;
    }
  }

  public async payPendingIncome(
    user: string,
    id: string,
    amount: number,
    paymentMethod: PaymentMethod,
    commission: number,
    comment: string,
    fiscalNote: string,
    promotionalCode: string,
    transactionId: string,
    bankEntity: string
  ): Promise<Income> {
    try {
      if (id) {
        const pendingIncome = await this.getIncomeById(id);
        if (pendingIncome && pendingIncome.id && pendingIncome.status === IncomeStatus.PENDING) {
          pendingIncome.amount = amount;
          pendingIncome.paymentMethod = paymentMethod;
          pendingIncome.commission = commission;
          pendingIncome.comment = comment;
          pendingIncome.fiscalNote = fiscalNote;
          pendingIncome.promotionalCode = promotionalCode;
          pendingIncome.transactionId = transactionId;
          pendingIncome.bankEntity = bankEntity;
          pendingIncome.status = IncomeStatus.CONFIRMED;
          pendingIncome.paid = true;
          pendingIncome.paidBy = user;
          pendingIncome.paidAt = new Date();
        }
        return await this.updateIncome(user, pendingIncome);
      }
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al pagar el income pendiente: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async cancelIncome(user: string, id: string): Promise<Income> {
    try {
      const income = await this.incomeRepository.findById(id);
      if (income && income.id) {
        if (!income.paid) {
          income.status = IncomeStatus.CANCELLED;
          income.cancelledAt = new Date();
          income.cancelledBy = user;
          return await this.updateIncome(user, income);
        } else {
          throw new HttpException(
            `No puede cancelar income porque está pagado`,
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        }
      } else {
        throw new HttpException(`Income no existe`, HttpStatus.NOT_FOUND);
      }
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al cancelar el income: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async confirmPendingIncome(user: string, id: string): Promise<Income> {
    try {
      if (id) {
        const pendingIncome = await this.getIncomeById(id);
        if (pendingIncome && pendingIncome.id && pendingIncome.status === IncomeStatus.PENDING) {
          pendingIncome.status = IncomeStatus.CONFIRMED;
          pendingIncome.paid = true;
          pendingIncome.paidBy = user;
          pendingIncome.paidAt = new Date();
        }
        return await this.updateIncome(user, pendingIncome);
      }
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al confirmar el pago de income pendiente: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
