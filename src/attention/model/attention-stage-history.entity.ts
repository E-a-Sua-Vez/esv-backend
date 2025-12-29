import { AttentionStage } from './attention-stage.enum';

export class AttentionStageHistory {
  stage: AttentionStage;
  enteredAt: Date;
  exitedAt?: Date;
  enteredBy: string; // collaboratorId
  exitedBy?: string; // collaboratorId
  duration?: number; // minutos
  notes?: string;
}







