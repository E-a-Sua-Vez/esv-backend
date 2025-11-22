import { Collection } from 'fireorm';

import { PackageStatus } from './package-status.enum';
import { PackageType } from './package-type.enum';

@Collection('package')
export class Package {
  id: string;
  commerceId: string;
  clientId: string;
  firstBookingId: string;
  firstAttentionId: string;
  proceduresAmount: number;
  proceduresLeft: number;
  totalAmount: number;
  name: string;
  servicesId: string[];
  bookingsId: string[];
  attentionsId: string[];
  incomesId: string[];
  paid: boolean;
  active: boolean;
  available: boolean;
  type: PackageType;
  status: PackageStatus;
  expireAt: Date;
  createdAt: Date;
  createdBy: string;
  cancelledAt: Date;
  cancelledBy: string;
  completedAt: Date;
  completedBy: string;
}
