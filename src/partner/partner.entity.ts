import { Collection } from 'fireorm';

@Collection('partner')
export class Partner {
  id: string;
  name: string;
  active: boolean;
  businessIds: string[];
  alias: string;
  email: string;
  phone: string;
  token: string;
  lastSignIn: Date;
  firstPasswordChanged: boolean;
  lastPasswordChanged: Date;
}
