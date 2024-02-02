import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BookingService } from './booking.service';
import { Booking } from './model/booking.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { BookingDetailsDto } from './dto/booking-details.dto';
import { User } from 'src/auth/user.decorator';

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
        const { queueId, channel, user, date } = body;
        return this.bookingService.createBooking(queueId, channel, date, user);
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

    //@UseGuards(AuthGuard)
    @Patch('/process/:date')
    public async processBookings(@Param() params: any): Promise<Booking> {
        const { date } = params;
        return this.bookingService.processBookings(date);
    }
}