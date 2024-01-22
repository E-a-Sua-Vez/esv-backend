import { Attention } from '../../attention/model/attention.entity';
import { Queue } from '../../queue/queue.entity';

export interface BuilderInterface {
  create(queueId: Queue, collaboratorId?: string, channel?: string): Promise<Attention>;
}
