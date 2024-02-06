import { User } from '../../user/user.entity';
import { Commerce } from '../../commerce/model/commerce.entity';
import { Queue } from '../../queue/model/queue.entity';
import { Collaborator } from '../../collaborator/model/collaborator.entity';
import { Module } from '../../module/module.entity';
import { Block } from '../model/attention.entity';

export class AttentionDetailsDto {
  id: string;
  commerceId: string;
  collaboratorId: string;
  createdAt: Date;
  endAt: Date;
  number: number;
  queueId: string;
  status: string;
  userId: string;
  moduleId: string;
  comment: string;
  surveyId: string;
  reactivatedAt: Date;
  reactivated: boolean;
  duration: number;
  type: string;
  assistingCollaboratorId: string;
  channel: string;
  queue: Queue;
  commerce: Commerce;
  user: User;
  ratedAt: Date;
  rateDuration: number;
  collaborator: Collaborator;
  module: Module;
  notificationOn: boolean;
  notificationEmailOn: boolean;
  block: Block;
}
