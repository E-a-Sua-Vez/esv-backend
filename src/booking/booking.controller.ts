import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { SimpleGuard } from 'src/auth/simple.guard';
import { User } from 'src/auth/user.decorator';

import { BookingService } from './booking.service';
import { BookingAvailabilityDto } from './dto/booking-availability.dto';
import { BookingDetailsDto } from './dto/booking-details.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { EditBookingDto } from './dto/edit-booking.dto';
import { TransferBookingDto } from './dto/transfer-booking.dto';
import { Booking } from './model/booking.entity';

@ApiTags('booking')
@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  /**
   * Sanitize string to prevent XSS
   */
  private sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return String(input || '');
    }
    return input
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/<script/gi, '') // Remove script tags
      .replace(/<iframe/gi, '') // Remove iframe tags
      .replace(/<object/gi, '') // Remove object tags
      .replace(/<embed/gi, '') // Remove embed tags
      .replace(/data:text\/html/gi, '') // Remove data URIs
      .replace(/eval\s*\(/gi, '') // Remove eval
      .replace(/expression\s*\(/gi, '') // Remove expression
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
      .trim();
  }

  /**
   * Recursively sanitize object
   */
  private sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (typeof value === 'string') {
          sanitized[key] = this.sanitizeString(value);
        } else if (typeof value === 'object') {
          sanitized[key] = this.sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
    }
    return sanitized;
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get booking by ID',
    description: 'Retrieves a booking by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Booking ID', example: 'booking-123' })
  @ApiResponse({ status: 200, description: 'Booking found', type: Booking })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  public async getBookingById(@Param() params: any): Promise<Booking> {
    const { id } = params;
    return this.bookingService.getBookingById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new booking',
    description: 'Creates a new booking/appointment for a queue',
  })
  @ApiBody({ type: CreateBookingDto })
  @ApiResponse({ status: 201, description: 'Booking created successfully', type: Booking })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Block already taken or queue limit reached',
  })
  public async createBooking(@Body() body: CreateBookingDto): Promise<Booking> {
    const {
      queueId,
      channel,
      user,
      date,
      block,
      status,
      servicesId,
      servicesDetails,
      clientId,
      sessionId,
      type,
      telemedicineConfig,
    } = body;
    // Convert DTOs to plain objects for Firestore serialization
    // Handle circular references and sanitize inputs
    let plainBlock = undefined;
    let plainUser = undefined;
    let plainTelemedicineConfig = undefined;

    try {
      if (block) {
        console.log('[BookingController] Incoming block from request:', JSON.stringify(block, null, 2));
        plainBlock = JSON.parse(JSON.stringify(block));
        console.log('[BookingController] Serialized block:', JSON.stringify(plainBlock, null, 2));
      }
    } catch (error) {
      throw new HttpException(
        `Error serializando bloque: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      if (user) {
        plainUser = JSON.parse(JSON.stringify(user));
        // Sanitize user inputs to prevent XSS
        if (plainUser.name && typeof plainUser.name === 'string') {
          plainUser.name = this.sanitizeString(plainUser.name);
        }
        if (plainUser.lastName && typeof plainUser.lastName === 'string') {
          plainUser.lastName = this.sanitizeString(plainUser.lastName);
        }
        if (plainUser.comment && typeof plainUser.comment === 'string') {
          plainUser.comment = this.sanitizeString(plainUser.comment);
        }
        if (plainUser.personalInfo && typeof plainUser.personalInfo === 'object') {
          // Recursively sanitize personalInfo
          plainUser.personalInfo = this.sanitizeObject(plainUser.personalInfo);
        }
      }
    } catch (error) {
      throw new HttpException(
        `Error serializando usuario: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      if (telemedicineConfig) {
        plainTelemedicineConfig = JSON.parse(JSON.stringify(telemedicineConfig));
        // Sanitize telemedicine notes
        if (plainTelemedicineConfig.notes && typeof plainTelemedicineConfig.notes === 'string') {
          plainTelemedicineConfig.notes = this.sanitizeString(plainTelemedicineConfig.notes);
        }
      }
    } catch (error) {
      throw new HttpException(
        `Error serializando configuración de telemedicina: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
    // Debug: Log what we're sending to service
    console.log('[BookingController] Sending to service:', {
      queueId,
      channel,
      date,
      hasBlock: !!plainBlock,
      block: plainBlock ? JSON.stringify(plainBlock, null, 2) : null,
      hasServicesId: !!servicesId,
      servicesId,
      hasServicesDetails: !!servicesDetails,
      servicesDetails: servicesDetails ? JSON.stringify(servicesDetails, null, 2) : null,
      clientId,
    });

    return this.bookingService.createBooking(
      queueId,
      channel,
      date,
      plainUser as any,
      plainBlock,
      status,
      servicesId,
      servicesDetails,
      clientId,
      sessionId,
      type,
      plainTelemedicineConfig
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/queue/:queueId/date/:date')
  @ApiOperation({
    summary: 'Get bookings by queue and date',
    description: 'Retrieves all bookings for a specific queue on a given date',
  })
  @ApiParam({ name: 'queueId', description: 'Queue ID', example: 'queue-123' })
  @ApiParam({ name: 'date', description: 'Date in YYYY-MM-DD format', example: '2024-01-15' })
  @ApiResponse({ status: 200, description: 'List of bookings', type: [Booking] })
  public async getBookingsByQueueAndDate(@Param() params: any): Promise<Booking[]> {
    const { date, queueId } = params;
    return this.bookingService.getBookingsByQueueAndDate(queueId, date);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/details/:id')
  @ApiOperation({
    summary: 'Get booking details',
    description: 'Retrieves detailed booking information including queue, commerce, and user data',
  })
  @ApiParam({ name: 'id', description: 'Booking ID', example: 'booking-123' })
  @ApiResponse({ status: 200, description: 'Booking details', type: BookingDetailsDto })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  public async getBookingDetails(@Param() params: any): Promise<BookingDetailsDto> {
    const { id } = params;
    return this.bookingService.getBookingDetails(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/cancel/:id')
  @ApiOperation({ summary: 'Cancel a booking', description: 'Cancels an existing booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: 'booking-123' })
  @ApiResponse({ status: 200, description: 'Booking cancelled successfully', type: Booking })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  public async cancelBooking(@User() user, @Param() params: any): Promise<Booking> {
    const { id } = params;
    return this.bookingService.cancelBooking(user, id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/confirm/:id')
  @ApiOperation({ summary: 'Confirm a booking', description: 'Confirms a pending booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: 'booking-123' })
  @ApiBody({ type: ConfirmBookingDto })
  @ApiResponse({ status: 200, description: 'Booking confirmed successfully', type: Booking })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  public async confirmBooking(
    @User() user,
    @Param() params: any,
    @Body() body: ConfirmBookingDto
  ): Promise<Booking> {
    const { id } = params;
    const { confirmationData } = body;
    return this.bookingService.confirmBooking(user, id, confirmationData);
  }

  @UseGuards(SimpleGuard)
  @Patch('/process')
  public async processBookings(): Promise<Booking> {
    const date = new Date().toISOString().slice(0, 10);
    return this.bookingService.processBookings(date);
  }

  @UseGuards(SimpleGuard)
  @Patch('/process/booking/:id')
  public async processBooking(@User() user, @Param() params: any): Promise<Booking> {
    const { id } = params;
    return this.bookingService.processBookingById(user, id);
  }

  @UseGuards(SimpleGuard)
  @Patch('/process/date/:date')
  public async processDateBookings(@Param() params: any): Promise<Booking> {
    const { date } = params;
    return this.bookingService.processBookings(date);
  }

  @UseGuards(AuthGuard)
  @Post('/waitlist/:id/block/:number')
  public async createBookingFromWaitlist(
    @Param() params: any,
    @Body() body: any
  ): Promise<Booking> {
    const { id, number } = params;
    return this.bookingService.createBookingFromWaitlist(id, number);
  }

  @UseGuards(SimpleGuard)
  @Post('/confirm')
  public async confirmNotifyBookings(): Promise<any> {
    return this.bookingService.confirmNotifyBookings();
  }

  @UseGuards(SimpleGuard)
  @Post('/process/past-bookings/:id/:collaboratorId/:commerceLanguage')
  public async processPastBooking(@Param() params: any): Promise<any> {
    const { id, collaboratorId, commerceLanguage } = params;
    return this.bookingService.processPastBooking(id, collaboratorId, commerceLanguage);
  }

  @UseGuards(AuthGuard)
  @Get('/pending/queue/:queueId/from/:dateFrom/to/:dateTo')
  public async getPendingBookingsBetweenDates(
    @Param() params: any
  ): Promise<BookingAvailabilityDto[]> {
    const { queueId, dateFrom, dateTo } = params;
    return this.bookingService.getPendingBookingsBetweenDates(queueId, dateFrom, dateTo);
  }

  @UseGuards(AuthGuard)
  @Get('/pending/commerce/:commerceId/:date')
  public async getPendingCommerceBookingsByDate(@Param() params: any): Promise<any> {
    const { commerceId, date } = params;
    return this.bookingService.getPendingCommerceBookingsByDate(commerceId, date);
  }

  @UseGuards(AuthGuard)
  @Get('/pending/commerce/:commerceId/from/:dateFrom/to/:dateTo')
  public async getPendingCommerceBookingsBetweenDates(
    @Param() params: any
  ): Promise<BookingAvailabilityDto[]> {
    const { commerceId, dateFrom, dateTo } = params;
    return this.bookingService.getPendingCommerceBookingsBetweenDates(commerceId, dateFrom, dateTo);
  }

  @UseGuards(SimpleGuard)
  @Patch('/pending/cancel/all')
  public async cancelBookings(): Promise<any> {
    return this.bookingService.cancelBookings();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/transfer/:id')
  @ApiOperation({
    summary: 'Transfer booking to another queue',
    description: 'Transfers a booking from one queue to another',
  })
  @ApiParam({ name: 'id', description: 'Booking ID', example: 'booking-123' })
  @ApiBody({ type: TransferBookingDto })
  @ApiResponse({ status: 200, description: 'Booking transferred successfully', type: Booking })
  @ApiResponse({ status: 404, description: 'Booking or queue not found' })
  public async transferBookingToQueue(
    @User() user,
    @Param() params: any,
    @Body() body: TransferBookingDto
  ): Promise<Booking> {
    const { id } = params;
    const { queueId } = body;
    return this.bookingService.transferBookingToQueue(user, id, queueId);
  }

  @UseGuards(AuthGuard)
  @Get('/commerceId/:commerceId/clientId/:clientId/idNumber/:idNumber')
  public async getBookingsByClient(@Param() params: any): Promise<Booking[]> {
    const { commerceId, clientId, idNumber } = params;
    return this.bookingService.getPendingBookingsByClient(commerceId, idNumber, clientId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/edit/:id')
  @ApiOperation({
    summary: 'Edit booking date and block',
    description: 'Updates the date and/or time block of an existing booking',
  })
  @ApiParam({ name: 'id', description: 'Booking ID', example: 'booking-123' })
  @ApiBody({ type: EditBookingDto })
  @ApiResponse({ status: 200, description: 'Booking updated successfully', type: Booking })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 409, description: 'Conflict - New block already taken' })
  public async editBookingDateAndBlock(
    @User() user,
    @Param() params: any,
    @Body() body: EditBookingDto
  ): Promise<Booking> {
    const { id } = params;
    const { date, block, telemedicineConfig } = body;
    // Convert DTO to plain object for Firestore serialization
    const plainBlock = block ? JSON.parse(JSON.stringify(block)) : undefined;
    const plainTelemedicineConfig = telemedicineConfig
      ? JSON.parse(JSON.stringify(telemedicineConfig))
      : undefined;
    return this.bookingService.editBookingDateAndBlock(
      user,
      id,
      date,
      plainBlock,
      plainTelemedicineConfig
    );
  }

  @UseGuards(AuthGuard)
  @Patch('/accept-terms/:id/:code')
  public async acceptBookingTermsAndConditions(
    @User() user,
    @Param() params: any
  ): Promise<Booking> {
    const { id, code } = params;
    return this.bookingService.acceptBookingTermsAndConditions(user, id, code);
  }
}
