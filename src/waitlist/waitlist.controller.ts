import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { Waitlist } from './model/waitlist.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { WaitlistDetailsDto } from './dto/waitlist-details.dto';

@Controller('waitlist')
export class WaitlistController {
    constructor(
        private readonly bookingService: WaitlistService,
    ) { }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getWaitlistById(@Param() params: any): Promise<Waitlist> {
        const { id } = params;
        return this.bookingService.getWaitlistById(id);
    }

    @UseGuards(AuthGuard)
    @Post()
    public async createWaitlist(@Body() body: any): Promise<Waitlist> {
        const { queueId, channel, user, date, clientId } = body;
        return this.bookingService.createWaitlist(queueId, channel, date, user, clientId);
    }

    @UseGuards(AuthGuard)
    @Get('/queue/:queueId/date/:date')
    public async getWaitlistsByQueueAndDate(@Param() params: any): Promise<Waitlist[]> {
        const { date, queueId } = params;
        return this.bookingService.getWaitlistsByQueueAndDate(queueId, date);
    }

    @UseGuards(AuthGuard)
    @Get('/details/:id')
    public async getWaitlistDetails(@Param() params: any): Promise<WaitlistDetailsDto> {
        const { id } = params;
        return this.bookingService.getWaitlistDetails(id);
    }
}