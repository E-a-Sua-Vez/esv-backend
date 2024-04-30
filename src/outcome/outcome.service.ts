import { Outcome, OutcomeInfo } from './model/outcome.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import OutcomeCreated from './events/OutcomeCreated';
import OutcomeUpdated from './events/OutcomeUpdated';
import { PaymentConfirmation } from '../payment/model/payment-confirmation';
import { OutcomeStatus } from './model/outcome-status.enum';
import { PaymentMethod } from '../payment/model/payment-method.enum';

@Injectable()
export class OutcomeService {
  constructor(
    @InjectRepository(Outcome)
    private outcomeRepository = getRepository(Outcome)
  ) {}

  public async getOutcomeById(id: string): Promise<Outcome> {
    let outcome = await this.outcomeRepository.findById(id);
    return outcome;
  }

  public async getOutcomes(): Promise<Outcome[]> {
    let outcomes: Outcome[] = [];
    outcomes = await this.outcomeRepository.find();
    return outcomes;
  }

  public async getOutcomeByCommerce(commerceId: string): Promise<Outcome[]> {
    let outcomes: Outcome[] = [];
    outcomes = await this.outcomeRepository
      .whereEqualTo('commerceId', commerceId)
      .find();
    return outcomes;
  }

  public async getPendingOutcomeByPackage(commerceId: string, packageId: string): Promise<Outcome[]> {
    let outcomes: Outcome[] = [];
    outcomes = await this.outcomeRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('packageId', packageId)
      .whereEqualTo('status', OutcomeStatus.PENDING)
      .find();
    return outcomes;
  }

  public async getOutcomesById(outcomesId: string[]): Promise<Outcome[]> {
    let outcomes: Outcome[] = [];
    outcomes = await this.outcomeRepository
      .whereIn('id', outcomesId)
      .find();
    return outcomes;
  }

  public async updateOutcomeConfigurations(user: string, id: string, outcomeInfo: OutcomeInfo, paymentConfirmation: PaymentConfirmation, status: OutcomeStatus): Promise<Outcome> {
    try {
      let outcome = await this.outcomeRepository.findById(id);
      if (outcomeInfo !== undefined) {
        outcome.outcomeInfo = outcomeInfo;
      }
      if (paymentConfirmation !== undefined) {
        outcome.paymentConfirmation = paymentConfirmation;
      }
      if (status !== undefined) {
        outcome.status = status;
      }
      return await this.updateOutcome(user, outcome);
    } catch (error) {
      throw new HttpException(`Hubo un problema al modificar el outcome: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async updateOutcome(user: string, outcome: Outcome): Promise<Outcome> {
    const outcomeUpdated = await await this.outcomeRepository.update(outcome);
    const outcomeUpdatedEvent = new OutcomeUpdated(new Date(), outcomeUpdated, { user });
    publish(outcomeUpdatedEvent);
    return outcomeUpdated;
  }

  public async createOutcome(user: string, commerceId: string, type: string, status: OutcomeStatus, bookingId: string, attentionId: string,
    clientId: string, packageId: string, amount: number, totalAmount: number, installments: number, paymentMethod: PaymentMethod,
    commission: number, comment: string, fiscalNote: string, promotionalCode: string, transactionId: string, bankEntity: string, outcomeInfo: OutcomeInfo,
    paymentType: string, paymentAmount: string, quantity: string, title: string, productId: string, productName: string, beneficiary: string, date: Date,
    code: string, expireDate: Date): Promise<Outcome> {
    let outcome = new Outcome();
    outcome.commerceId = commerceId;
    outcome.type = type;
    outcome.bookingId = bookingId;
    outcome.attentionId = attentionId;
    outcome.clientId = clientId;
    outcome.outcomeInfo = outcomeInfo;
    outcome.packageId = packageId;
    outcome.status = status || OutcomeStatus.PENDING;
    outcome.amount = amount;
    outcome.totalAmount = totalAmount;
    outcome.installments = installments;
    outcome.paymentMethod = paymentMethod;
    outcome.commission = commission;
    outcome.comment = comment;
    outcome.fiscalNote = fiscalNote;
    outcome.promotionalCode = promotionalCode;
    outcome.transactionId = transactionId;
    outcome.bankEntity = bankEntity;
    if (installments === 1 && status === OutcomeStatus.CONFIRMED) {
      outcome.paid = true;
      outcome.paidAt = new Date();
      outcome.paidBy = user;
    }
    outcome.paymentType = paymentType;
    outcome.paymentAmount = paymentAmount;
    outcome.quantity = quantity;
    outcome.title = title;
    outcome.productId = productId;
    outcome.productName = productName;
    outcome.beneficiary = beneficiary;
    outcome.date = date;
    outcome.code = code;
    outcome.expireDate = expireDate;
    outcome.createdAt = new Date();
    outcome.createdBy = user;
    const outcomeCreated = await this.outcomeRepository.create(outcome);
    const outcomeCreatedEvent = new OutcomeCreated(new Date(), outcomeCreated, { user });
    publish(outcomeCreatedEvent);
    return outcomeCreated;
  }

  public async cancelOutcome(
    user: string, id: string
  ): Promise<Outcome> {
    try {
      let outcome = await this.outcomeRepository.findById(id);
      if (outcome && outcome.id) {
        if (!outcome.paid) {
          outcome.status = OutcomeStatus.CANCELLED;
          outcome.cancelledAt = new Date();
          outcome.cancelledBy = user;
          return await this.updateOutcome(user, outcome);
        } else {
          throw new HttpException(`No puede cancelar outcome porque está pagado`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
      } else {
        throw new HttpException(`Outcome no existe`, HttpStatus.NOT_FOUND);
      }
    } catch (error) {
      throw new HttpException(`Hubo un problema al cancelar el outcome: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
