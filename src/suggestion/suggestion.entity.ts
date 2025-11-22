import { Collection } from 'fireorm';

@Collection('suggestion')
export class Suggestion {
  id: string;
  type: string;
  comment: string;
  userId: string;
  userType: string;
  createdAt: Date;
}
