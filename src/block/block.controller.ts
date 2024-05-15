import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { BlockService } from './block.service';
import { Block } from './model/block.entity';

@Controller('block')
export class BlockController {
    constructor(
        private readonly blockService: BlockService,
    ) { }

    @UseGuards(AuthGuard)
    @Get('/queueId/:queueId')
    public async getBlocksByQueueId(@Param() params: any): Promise<Block[]> {
        const { queueId } = params;
        return this.blockService.getQueueBlockDetails(queueId);
    }

    @UseGuards(AuthGuard)
    @Get('/day/queueId/:queueId')
    public async getQueueBlockDetailsByDay(@Param() params: any): Promise<Record<string, Block[]>> {
        const { queueId } = params;
        return this.blockService.getQueueBlockDetailsByDay(queueId);
    }

    @UseGuards(AuthGuard)
    @Get('/day/commerceId/:commerceId')
    public async getQueueBlockDetailsByDayByCommerceId(@Param() params: any): Promise<Record<string, Record<string, Block[]>>> {
        const { commerceId } = params;
        return this.blockService.getQueueBlockDetailsByDayByCommerceId(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/specific-day/commerceId/:commerceId/queueId/:queueId')
    public async getQueueBlockDetailsBySpecificDayByCommerceId(@Param() params: any): Promise<Record<string, Block[]>> {
        const { commerceId, queueId } = params;
        return this.blockService.getQueueBlockDetailsBySpecificDayByCommerceId(commerceId, queueId);
    }
}