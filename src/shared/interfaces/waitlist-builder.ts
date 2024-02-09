import { Waitlist } from 'src/waitlist/model/waitlist.entity';
import { Queue } from '../../queue/model/queue.entity';

export interface WaitlistBuilderInterface {
  create(date: string, queueId: Queue, channel?: string): Promise<Waitlist>;
}
