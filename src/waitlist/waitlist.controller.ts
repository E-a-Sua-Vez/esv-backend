import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
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

import { WaitlistDetailsDto } from './dto/waitlist-details.dto';
import { Waitlist } from './model/waitlist.entity';
import { WaitlistService } from './waitlist.service';

@ApiTags('waitlist')
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly bookingService: WaitlistService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get waitlist by ID',
    description: 'Retrieves a waitlist entry by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Waitlist ID', example: 'waitlist-123' })
  @ApiResponse({ status: 200, description: 'Waitlist found', type: Waitlist })
  @ApiResponse({ status: 404, description: 'Waitlist not found' })
  public async getWaitlistById(@Param() params: any): Promise<Waitlist> {
    const { id } = params;
    return this.bookingService.getWaitlistById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new waitlist entry',
    description: 'Adds a client to the waitlist for a queue',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        queueId: { type: 'string', example: 'queue-123' },
        channel: { type: 'string', example: 'QR' },
        user: { type: 'object' },
        date: { type: 'string', example: '2024-01-15' },
        clientId: { type: 'string', example: 'client-123' },
      },
      required: ['queueId', 'date'],
    },
  })
  @ApiResponse({ status: 201, description: 'Waitlist entry created successfully', type: Waitlist })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createWaitlist(@Body() body: any): Promise<Waitlist> {
    const { queueId, channel, user, date, clientId } = body;
    return this.bookingService.createWaitlist(queueId, channel, date, user, clientId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/queue/:queueId/date/:date')
  @ApiOperation({
    summary: 'Get waitlists by queue and date',
    description: 'Retrieves all waitlist entries for a specific queue on a given date',
  })
  @ApiParam({ name: 'queueId', description: 'Queue ID', example: 'queue-123' })
  @ApiParam({ name: 'date', description: 'Date in YYYY-MM-DD format', example: '2024-01-15' })
  @ApiResponse({ status: 200, description: 'List of waitlist entries', type: [Waitlist] })
  public async getWaitlistsByQueueAndDate(@Param() params: any): Promise<Waitlist[]> {
    const { date, queueId } = params;
    return this.bookingService.getWaitlistsByQueueAndDate(queueId, date);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/details/:id')
  @ApiOperation({
    summary: 'Get waitlist details',
    description: 'Retrieves detailed waitlist information',
  })
  @ApiParam({ name: 'id', description: 'Waitlist ID', example: 'waitlist-123' })
  @ApiResponse({ status: 200, description: 'Waitlist details', type: WaitlistDetailsDto })
  @ApiResponse({ status: 404, description: 'Waitlist not found' })
  public async getWaitlistDetails(@Param() params: any): Promise<WaitlistDetailsDto> {
    const { id } = params;
    return this.bookingService.getWaitlistDetails(id);
  }
}
