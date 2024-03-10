import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { QueueService } from './queue.service';
import { Queue } from './model/queue.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { SimpleGuard } from '../auth/simple.guard';
import { User } from 'src/auth/user.decorator';

@Controller('queue')
export class QueueController {
    constructor(private readonly queueService: QueueService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getQueueById(@Param() params: any): Promise<Queue> {
        const { id } = params;
        return this.queueService.getQueueById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getQueues(): Promise<Queue[]> {
        return this.queueService.getQueues();
    }

    @UseGuards(AuthGuard)
    @Get('/commerce/:commerceId')
    public async getQueueByCommerce(@Param() params: any): Promise<Queue[]> {
        const { commerceId } = params;
        return this.queueService.getQueueByCommerce(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('grouped/commerce/:commerceId')
    public async getGroupedQueueByCommerce(@Param() params: any): Promise<Record<string, Queue[]>> {
        const { commerceId } = params;
        return this.queueService.getGroupedQueueByCommerce(commerceId);
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createQueue(@User() user, @Body() body: Queue): Promise<Queue> {
        const { commerceId, type, name, tag, limit, estimatedTime, order, serviceInfo, blockTime, collaboratorId, serviceId } = body;
        return this.queueService.createQueue(user, commerceId, type, name, tag, limit, estimatedTime, order, serviceInfo, blockTime, collaboratorId, serviceId);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateQueue(@User() user, @Param() params: any, @Body() body: Queue): Promise<Queue> {
        const { id } = params;
        const { name, limit, estimatedTime, order, active, available, serviceInfo, blockTime } = body;
        return this.queueService.updateQueueConfigurations(user, id, name, limit, estimatedTime, order, active, available, serviceInfo, blockTime);
    }

    @UseGuards(SimpleGuard)
    @Patch('/restart/all')
    public async restartAll(){
        return this.queueService.restartAll();
    }
}