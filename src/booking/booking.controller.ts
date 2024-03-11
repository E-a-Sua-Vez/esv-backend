import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BookingService } from './booking.service';
import { Booking } from './model/booking.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { BookingDetailsDto } from './dto/booking-details.dto';
import { User } from 'src/auth/user.decorator';
import { SimpleGuard } from 'src/auth/simple.guard';

@Controller('booking')
export class BookingController {
    constructor(
        private readonly bookingService: BookingService,
    ) { }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getBookingById(@Param() params: any): Promise<Booking> {
        const { id } = params;
        return this.bookingService.getBookingById(id);
    }

    @UseGuards(AuthGuard)
    @Post()
    public async createBooking(@Body() body: any): Promise<Booking> {
        const { queueId, channel, user, date, block, status } = body;
        return this.bookingService.createBooking(queueId, channel, date, user, block, status);
    }

    @UseGuards(AuthGuard)
    @Get('/queue/:queueId/date/:date')
    public async getBookingsByQueueAndDate(@Param() params: any): Promise<Booking[]> {
        const { date, queueId } = params;
        return this.bookingService.getBookingsByQueueAndDate(queueId, date);
    }

    @UseGuards(AuthGuard)
    @Get('/details/:id')
    public async getBookingDetails(@Param() params: any): Promise<BookingDetailsDto> {
        const { id } = params;
        return this.bookingService.getBookingDetails(id);
    }

    @UseGuards(AuthGuard)
    @Patch('/cancel/:id')
    public async cancelBooking(@User() user, @Param() params: any, @Body() body: any): Promise<Booking> {
        const { id } = params;
        return this.bookingService.cancelBooking(user, id);
    }

    @UseGuards(SimpleGuard)
    @Patch('/process')
    public async processBookings(): Promise<Booking> {
        const date = new Date().toISOString().slice(0,10);
        return this.bookingService.processBookings(date);
    }

    @UseGuards(SimpleGuard)
    @Patch('/process/date/:date')
    public async processDateBookings(@Param() params: any): Promise<Booking> {
        const { date } = params;
        return this.bookingService.processBookings(date);
    }

    @UseGuards(AuthGuard)
    @Post('/waitlist/:id/block/:number')
    public async createBookingFromWaitlist(@Param() params: any, @Body() body: any): Promise<Booking> {
        const { id, number } = params;
        return this.bookingService.createBookingFromWaitlist(id, number);
    }

    @UseGuards(SimpleGuard)
    @Post('/confirm')
    public async confirmNotifyBookings(@Body() body: any): Promise<any> {
        const { daysBefore } = body;
        return this.bookingService.confirmNotifyBookings(daysBefore);
    }

    @UseGuards(SimpleGuard)
    @Post('/process/past-bookings/:id/:collaboratorId/:commerceLanguage')
    public async processPastBooking(@Param() params: any): Promise<any> {
        const { id, collaboratorId, commerceLanguage } = params;
        return this.bookingService.processPastBooking(id, collaboratorId, commerceLanguage);
    }

    @UseGuards(AuthGuard)
    @Get('/pending/queue/:queueId/from/:dateFrom/to/:dateTo')
    public async getPendingBookingsBetweenDates(@Param() params: any): Promise<any> {
        const { queueId, dateFrom, dateTo } = params;
        return this.bookingService.getPendingBookingsBetweenDates(queueId, dateFrom, dateTo);
    }
}