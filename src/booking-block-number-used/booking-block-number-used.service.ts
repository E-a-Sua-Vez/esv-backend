import { Injectable } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { Block } from 'src/booking/model/booking.entity';

import { BookingBlockNumberUsed } from './model/booking-block-number-used';

@Injectable()
export class BookingBlockNumberUsedService {
  constructor(
    @InjectRepository(BookingBlockNumberUsed)
    private bookingBlockNumbersUsedRepository = getRepository(BookingBlockNumberUsed)
  ) {}

  public async getTakenBookingsBlocksByDate(
    sessionId: string,
    queueId: string,
    date: string
  ): Promise<BookingBlockNumberUsed[]> {
    if (sessionId) {
      const takenBlocks = await this.bookingBlockNumbersUsedRepository
        .whereEqualTo('date', date)
        .whereEqualTo('queueId', queueId)
        .whereEqualTo('sessionId', sessionId)
        .orderByAscending('time')
        .find();
      return takenBlocks;
    } else {
      const takenBlocks = await this.bookingBlockNumbersUsedRepository
        .whereEqualTo('date', date)
        .whereEqualTo('queueId', queueId)
        .orderByAscending('time')
        .find();
      return takenBlocks;
    }
  }

  public async createTakenBookingsBlocksByDate(
    queueId: string,
    date: string,
    block: Block
  ): Promise<BookingBlockNumberUsed[]> {
    const takenBlocks = [];
    let blocks: Block[] = [];
    if (block.blocks && block.blocks.length > 0) {
      blocks = block.blocks;
    } else {
      blocks.push(block);
    }
    if (blocks && blocks.length > 0) {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const newBlock = new BookingBlockNumberUsed();
        newBlock.blockNumber = block.number;
        newBlock.hourFrom = block.hourFrom;
        newBlock.hourTo = block.hourTo;
        newBlock.queueId = queueId;
        newBlock.date = date;
        newBlock.dateRequested = new Date();
        newBlock.time = new Date().getTime();
        const blockCreated = await this.bookingBlockNumbersUsedRepository.create(newBlock);
        takenBlocks.push(blockCreated);
      }
    }
    return takenBlocks;
  }

  public async deleteTakenBookingsBlocksByDate(
    sessionId: string,
    queueId: string,
    date: string,
    block: Block
  ): Promise<BookingBlockNumberUsed[]> {
    let blocks: Block[] = [];
    const takenBlocks = await this.getTakenBookingsBlocksByDate(sessionId, queueId, date);
    if (block.blocks && block.blocks.length > 0) {
      blocks = block.blocks;
    } else {
      blocks.push(block);
    }
    if (blocks && blocks.length > 0) {
      if (sessionId) {
        for (let i = 0; i < takenBlocks.length; i++) {
          const block = takenBlocks[i];
          await this.bookingBlockNumbersUsedRepository.delete(block.id);
        }
      } else {
        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          const blockToDelete = takenBlocks.filter(
            bck => bck.hourFrom === block.hourFrom && bck.hourTo === block.hourTo
          )[0];
          if (blockToDelete && blockToDelete.id) {
            await this.bookingBlockNumbersUsedRepository.delete(blockToDelete.id);
          }
        }
      }
    }
    return takenBlocks;
  }

  public async editQueueTakenBookingsBlocksByDate(
    queueId: string,
    date: string,
    block: Block,
    queueIdTo: string
  ): Promise<BookingBlockNumberUsed[]> {
    let blocks: Block[] = [];
    const takenBlocks = await this.getTakenBookingsBlocksByDate(undefined, queueId, date);
    if (block.blocks && block.blocks.length > 0) {
      blocks = block.blocks;
    } else {
      blocks.push(block);
    }
    if (blocks && blocks.length > 0) {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const blockToUpdate = takenBlocks.filter(
          bck => bck.hourFrom === block.hourFrom && bck.hourTo === block.hourTo
        )[0];
        if (blockToUpdate && blockToUpdate.id) {
          blockToUpdate.queueId = queueIdTo;
          await this.bookingBlockNumbersUsedRepository.update(blockToUpdate);
        }
      }
    }
    return takenBlocks;
  }

  public async editHourAndDateTakenBookingsBlocksByDate(
    queueId: string,
    dateFrom: string,
    blockFrom: Block,
    dateTo: string,
    blockTo: Block
  ): Promise<BookingBlockNumberUsed[]> {
    await this.deleteTakenBookingsBlocksByDate(undefined, queueId, dateFrom, blockFrom);
    const takenBlocks = await this.createTakenBookingsBlocksByDate(queueId, dateTo, blockTo);
    return takenBlocks;
  }
}
