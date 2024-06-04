import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { Injectable } from '@nestjs/common';
import { BookingBlockNumberUsed } from './model/booking-block-number-used';
import { Block } from 'src/booking/model/booking.entity';

@Injectable()
export class BookingBlockNumberUsedService {
  constructor(
    @InjectRepository(BookingBlockNumberUsed)
    private bookingBlockNumbersUsedRepository = getRepository(BookingBlockNumberUsed)
  ) { }

  public async getTakenBookingsBlocksByDate(sessionId: string, queueId: string, date: string): Promise<BookingBlockNumberUsed[]> {
    const takenBlocks = await this.bookingBlockNumbersUsedRepository
      .whereEqualTo('date', date)
      .whereEqualTo('queueId', queueId)
      .whereNotEqualTo('sessionId', sessionId)
      .find();
    return takenBlocks;
  }

  public async deleteTakenBookingsBlocksByDate(queueId: string, date: string, block: Block): Promise<BookingBlockNumberUsed[]> {
    let blocks: Block[] = [];
    const takenBlocks = await this.bookingBlockNumbersUsedRepository
      .whereEqualTo('date', date)
      .whereEqualTo('queueId', queueId)
      .find();
    console.log("🚀 ~ BookingBlockNumberUsedService ~ deleteTakenBookingsBlocksByDate ~ takenBlocks:", takenBlocks);
    if (block.blocks && block.blocks.length > 0) {
        blocks = block.blocks;
    } else {
      blocks.push(block);
    }
    if (blocks && blocks.length > 0) {
      console.log("🚀 ~ BookingBlockNumberUsedService ~ deleteTakenBookingsBlocksByDate ~ blocks:", blocks);
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const blockToDelete = takenBlocks.filter(bck => bck.hourFrom === block.hourFrom && bck.hourTo === block.hourTo);
        console.log("🚀 ~ BookingBlockNumberUsedService ~ deleteTakenBookingsBlocksByDate ~ blockToDelete:", blockToDelete);
        if (blockToDelete && blockToDelete.length > 0) {
          await this.bookingBlockNumbersUsedRepository.delete(blockToDelete[0].id);
        }
      }
    }
    return takenBlocks;
  }
}