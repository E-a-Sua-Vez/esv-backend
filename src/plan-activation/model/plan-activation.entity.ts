import { Collection } from 'fireorm';
import { Payment } from 'src/payment/model/payment.entity';
import { Periodicity } from 'src/plan/model/periodicity.enum';
import { Plan } from 'src/plan/model/plan.entity';

import { Business } from '../../business/model/business.entity';

import { ArtifactStatus } from './artifacts-status';

@Collection('plan-activation')
export class PlanActivation {
  id: string;
  planId: string;
  businessId: string;
  createdAt: Date;
  payedAt: Date;
  paymentId: string;
  startDate: Date;
  endDate: Date;
  desactivatedAt: Date;
  validatedAt: Date;
  periodicity: Periodicity;
  validated: boolean;
  active: boolean;
  renewable: boolean;
  origin: string;
  planPayedCopy: Plan;
  paymentMethod: string;
  business: Business;
  payment: Payment;
  permissions: Record<string, boolean | number>;
  artifactStatus: ArtifactStatus;
  termsAccepted: boolean;
}
