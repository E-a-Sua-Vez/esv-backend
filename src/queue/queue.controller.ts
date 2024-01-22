import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { QueueService } from './queue.service';
import { Queue } from './queue.entity';
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
    @Post('/')
    public async createQueue(@User() user, @Body() body: Queue): Promise<Queue> {
        const { commerceId, name, limit, estimatedTime, order, serviceInfo} = body;
        return this.queueService.createQueue(user, commerceId, name, limit, estimatedTime, order, serviceInfo);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateQueue(@User() user, @Param() params: any, @Body() body: Queue): Promise<Queue> {
        const { id } = params;
        const { limit, estimatedTime, order, active, serviceInfo } = body;
        return this.queueService.updateQueueConfigurations(user, id, limit, estimatedTime, order, active, serviceInfo);
    }

    @UseGuards(SimpleGuard)
    @Patch('/restart/all')
    public async restartAll(){
        return this.queueService.restartAll();
    }
}