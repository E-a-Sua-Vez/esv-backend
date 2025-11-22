import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { User } from 'src/auth/user.decorator';

import { SimpleGuard } from '../auth/simple.guard';

import { QueueDetailsDto } from './dto/queue-details.dto';
import { Queue } from './model/queue.entity';
import { QueueService } from './queue.service';

@ApiTags('queue')
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get queue by ID',
    description: 'Retrieves a queue by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Queue ID', example: 'queue-123' })
  @ApiResponse({ status: 200, description: 'Queue found', type: Queue })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  public async getQueueById(@Param() params: any): Promise<Queue> {
    const { id } = params;
    return this.queueService.getQueueById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({ summary: 'Get all queues', description: 'Retrieves a list of all queues' })
  @ApiResponse({ status: 200, description: 'List of queues', type: [Queue] })
  public async getQueues(): Promise<Queue[]> {
    return this.queueService.getQueues();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId')
  @ApiOperation({
    summary: 'Get queues by commerce',
    description: 'Retrieves all queues for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of queues', type: [Queue] })
  public async getQueueByCommerce(@Param() params: any): Promise<Queue[]> {
    const { commerceId } = params;
    return this.queueService.getQueueByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('grouped/commerce/:commerceId')
  @ApiOperation({
    summary: 'Get grouped queues by commerce',
    description: 'Retrieves queues grouped by type for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'Grouped queues', type: 'object' })
  public async getGroupedQueueByCommerce(
    @Param() params: any
  ): Promise<Record<string, QueueDetailsDto[]>> {
    const { commerceId } = params;
    return this.queueService.getGroupedQueueByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new queue', description: 'Creates a new service queue' })
  @ApiBody({ type: Queue })
  @ApiResponse({ status: 201, description: 'Queue created successfully', type: Queue })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createQueue(@User() user, @Body() body: Queue): Promise<Queue> {
    const {
      commerceId,
      type,
      name,
      tag,
      limit,
      estimatedTime,
      order,
      serviceInfo,
      blockTime,
      collaboratorId,
      serviceId,
      servicesId,
    } = body;
    return this.queueService.createQueue(
      user,
      commerceId,
      type,
      name,
      tag,
      limit,
      estimatedTime,
      order,
      serviceInfo,
      blockTime,
      collaboratorId,
      serviceId,
      servicesId
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update queue',
    description: 'Updates the configuration of an existing queue',
  })
  @ApiParam({ name: 'id', description: 'Queue ID', example: 'queue-123' })
  @ApiBody({ type: Queue })
  @ApiResponse({ status: 200, description: 'Queue updated successfully', type: Queue })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  public async updateQueue(
    @User() user,
    @Param() params: any,
    @Body() body: Queue
  ): Promise<Queue> {
    const { id } = params;
    const {
      name,
      limit,
      estimatedTime,
      order,
      active,
      available,
      online,
      serviceInfo,
      blockTime,
      servicesId,
    } = body;
    return this.queueService.updateQueueConfigurations(
      user,
      id,
      name,
      limit,
      estimatedTime,
      order,
      active,
      available,
      online,
      serviceInfo,
      blockTime,
      servicesId
    );
  }

  @UseGuards(SimpleGuard)
  @Patch('/restart/all')
  public async restartAll() {
    return this.queueService.restartAll();
  }
}
