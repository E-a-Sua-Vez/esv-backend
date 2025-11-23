import { Collection } from 'fireorm';

export class FeatureToggleOption {
  name: string;
  type: string;
}

@Collection('feature-toggle')
export class FeatureToggle {
  id: string;
  name: string;
  description: string;
  type: string;
  commerceId: string;
  active: boolean;
  createdAt: Date;
  modifiedAt: Date;
}
