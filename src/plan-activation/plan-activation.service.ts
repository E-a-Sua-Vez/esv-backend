import { PlanActivation } from './model/plan-activation.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';
import { Plan } from 'src/plan/model/plan.entity';
import { HttpException, HttpStatus } from '@nestjs/common';
import { BusinessService } from '../business/business.service';
import { PlanService } from '../plan/plan.service';
import { PaymentService } from 'src/payment/payment.service';
import PlanActivationCreated from './events/PlanActivationCreated';
import PlanActivationUpdated from './events/PlanActivationUpdated';
import { BankAccount } from 'src/payment/model/bank-account';
import { PaymentMethod } from 'src/payment/model/payment-method.enum';
import { Periodicity, periodicityDayValues } from 'src/plan/model/periodicity.enum';


export class PlanActivationService {
  constructor(
    @InjectRepository(PlanActivation)
    private planActivationRepository = getRepository(PlanActivation),
    private businessService: BusinessService,
    private planService: PlanService,
    private paymentService: PaymentService
  ) {}

  public async getPlanActivationById(id: string): Promise<PlanActivation> {
    return await this.planActivationRepository.findById(id);
  }

  public async getPlanActivationByBusinessId(businessId: string): Promise<PlanActivation[]> {
    const planActivations = await this.planActivationRepository
      .whereEqualTo('businessId', businessId)
      .orderByDescending('createdAt')
      .find();
    return planActivations;
  }

  public async getValidatedPlanActivationByBusinessId(businessId: string, validated: string): Promise<PlanActivation> {
    const validateBoolean = validated === 'true';
    let planActivation = undefined;
    const planActivations = await this.planActivationRepository
      .whereEqualTo('businessId', businessId)
      .whereEqualTo('validated', validateBoolean)
      .orderByDescending('createdAt')
      .find();
    if (planActivations.length > 0) {
      planActivation = planActivations[0];
      if (planActivation.paymentId) {
        planActivation.payment = await this.paymentService.getPaymentById(planActivation.paymentId);
      }
      return planActivation;
    }
    return undefined;
  }

  public async getValidatedPlanActivation(validated: string): Promise<PlanActivation[]> {
    const validateBoolean = validated === 'true';
    const planActivations = await this.planActivationRepository
      .whereEqualTo('validated', validateBoolean)
      .orderByDescending('createdAt')
      .find();
    if (planActivations.length > 0) {
      for(let i = 0; i < planActivations.length; i++) {
        planActivations[i].business = await this.businessService.getBusinessById(planActivations[i].businessId);
        if (planActivations[i].paymentId) {
          planActivations[i].payment = await this.paymentService.getPaymentById(planActivations[i].paymentId);
        }
      }
    }
    return planActivations;
  }

  public async createPlanActivation(user: string, businessId: string, planId: string, planPayedCopy: Plan, renewable = false, origin: string, paymentMethod: string, termsAccepted): Promise<PlanActivation> {
    let planActivation = new PlanActivation();
    if (!businessId || !planId || !planPayedCopy || !paymentMethod || termsAccepted === undefined) {
      throw new HttpException(`No hay suficientes datos para activar el plan`, HttpStatus.BAD_REQUEST);
    }
    if (termsAccepted === 'false' || !termsAccepted) {
      throw new HttpException(`No se aceptaron los terminos y condiciones`, HttpStatus.BAD_REQUEST);
    }
    const validatedPlanActivation = await this.getValidatedPlanActivationByBusinessId(businessId, 'false');
    if (validatedPlanActivation) {
      throw new HttpException(`Ya tienes una solicitud de activacion de plan pendiente por validar`, HttpStatus.BAD_REQUEST);
    }
    planActivation.businessId = businessId;
    const business = await this.businessService.getBusinessById(businessId);
    if (!business) {
      throw new HttpException(`Negocio no existe`, HttpStatus.BAD_REQUEST);
    }
    planActivation.planId = planId;
    const plan = await this.planService.getPlanById(planId);
    if (!plan) {
      throw new HttpException(`Plan no existe`, HttpStatus.BAD_REQUEST);
    }
    planActivation.origin = origin;
    planActivation.active = false;
    planActivation.renewable = renewable;
    planActivation.planPayedCopy = planPayedCopy;
    planActivation.paymentMethod = paymentMethod;
    planActivation.createdAt = new Date();
    planActivation.validated = false;
    planActivation.permissions = await this.planService.desactivatedPermissionsForPlan(planId);
    planActivation.termsAccepted = termsAccepted;
    const planActivationCreated = await this.planActivationRepository.create(planActivation);
    const planActivationCreatedEvent = new PlanActivationCreated(new Date(), planActivationCreated, { user });
    publish(planActivationCreatedEvent);
    return planActivationCreated;
  }

  public async update(user: string, planActivation: PlanActivation): Promise<PlanActivation> {
    const planActivationUpdated = await this.planActivationRepository.update(planActivation);
    const planActivationUpdatedEvent = new PlanActivationUpdated(new Date(), planActivationUpdated, { user });
    publish(planActivationUpdatedEvent);
    return planActivationUpdated;
  }

  private getEndDate(startDate: Date, periodicity: Periodicity): Date {
    const daysToAdd = periodicityDayValues[periodicity];
    return new Date(startDate.setDate(new Date().getDate() + daysToAdd));
  }

  public async validate(user: string, id: string, businessId: string, planId: string, amount: number, paymentNumber: string, paymentDate: Date, bankData: BankAccount, method: PaymentMethod): Promise<PlanActivation> {
    try {
      if (!id || !businessId || !planId || amount === undefined || !paymentNumber) {
        throw new HttpException(`No hay suficientes datos para validar el plan`, HttpStatus.BAD_REQUEST);
      }
      if (amount < 0) {
        throw new HttpException(`Monto debe ser mayor a 0`, HttpStatus.BAD_REQUEST);
      }
      const payment = await this.paymentService.createPayment(user, businessId, planId, amount, paymentNumber, paymentDate, bankData, method);
      if (!payment || !payment.id) {
        throw new HttpException(`No existe pago valido para activar el plan`, HttpStatus.BAD_REQUEST);
      }
      const plan = await this.planService.getPlanById(planId);
      if (!plan) {
        throw new HttpException(`Plan no existe`, HttpStatus.BAD_REQUEST);
      }
      let planActivation = await this.getPlanActivationById(id);
      if (!planActivation) {
        throw new HttpException(`Activacion de Plan no existe`, HttpStatus.BAD_REQUEST);
      }
      if (!planActivation) {
        throw new HttpException(`Payment no existe`, HttpStatus.BAD_REQUEST);
      }
      planActivation.paymentId = payment.id;
      planActivation.payedAt = payment.createdAt;
      planActivation.startDate = new Date();
      planActivation.endDate = this.getEndDate(new Date(), plan.periodicity);
      planActivation.paymentMethod = method;
      planActivation.validated = true;
      planActivation.active = true;
      planActivation.validatedAt = new Date();
      planActivation.permissions = await this.planService.activatedPermissionsForPlan(planId);
      planActivation = await this.update(user, planActivation);
      await this.businessService.activateBusiness(user, businessId, planId, planActivation.id);
      return planActivation;
    } catch(error){
      throw `Hubo un problema al activar el plan: ${error.message}`;
    }
  }

  public async desactivate(user: string, planId: string): Promise<PlanActivation> {
    try {
      if (!planId) {
        throw new HttpException(`No hay suficientes datos para validar la activacion del plan`, HttpStatus.BAD_REQUEST);
      }
      let planActivation = await this.getPlanActivationById(planId);
      if (!planActivation) {
        throw new HttpException(`Activacion de Plan no existe`, HttpStatus.BAD_REQUEST);
      }
      if (planActivation.active === false && planActivation.validated === true) {
        throw new HttpException(`Activacion de Plan ya esta inactivo`, HttpStatus.BAD_REQUEST);
      }
      /*if (new Date() < planActivation.endDate) {
        throw new HttpException(`Plan no puede ser desativado antes de la fecha de vencimiento`, HttpStatus.BAD_REQUEST);
      }*/
      planActivation.active = false;
      planActivation.desactivatedAt = new Date();
      planActivation.permissions = await this.planService.desactivatedPermissionsForPlan(planActivation.planId);
      await this.businessService.desactivateBusiness(user, planActivation.businessId);
      planActivation = await this.update(user, planActivation);
      return planActivation;
    } catch(error){
      throw `Hubo un problema al activar el plan: ${error.message}`;
    }
  }
}
