import { Collection } from 'fireorm';

@Collection('feature')
export class Feature {
  id: string;
  name: string;
  description: string;
  type: string;
  module: string;
  active: boolean;
  createdAt: Date;
  modifiedAt: Date;
}
