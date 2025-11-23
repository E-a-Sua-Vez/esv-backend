import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

import { BlockService } from './block.service';
import { Block } from './model/block.entity';

@ApiTags('block')
@Controller('block')
export class BlockController {
  constructor(private readonly blockService: BlockService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/queueId/:queueId')
  @ApiOperation({
    summary: 'Get blocks by queue ID',
    description: 'Retrieves all time blocks for a specific queue',
  })
  @ApiParam({ name: 'queueId', description: 'Queue ID', example: 'queue-123' })
  @ApiResponse({ status: 200, description: 'List of blocks', type: [Block] })
  public async getBlocksByQueueId(@Param() params: any): Promise<Block[]> {
    const { queueId } = params;
    return this.blockService.getQueueBlockDetails(queueId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/day/queueId/:queueId')
  @ApiOperation({
    summary: 'Get blocks by queue grouped by day',
    description: 'Retrieves time blocks for a queue organized by day',
  })
  @ApiParam({ name: 'queueId', description: 'Queue ID', example: 'queue-123' })
  @ApiResponse({
    status: 200,
    description: 'Blocks grouped by day',
    schema: {
      type: 'object',
      additionalProperties: { type: 'array', items: { $ref: '#/components/schemas/Block' } },
    },
  })
  public async getQueueBlockDetailsByDay(@Param() params: any): Promise<Record<string, Block[]>> {
    const { queueId } = params;
    return this.blockService.getQueueBlockDetailsByDay(queueId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/day/commerceId/:commerceId')
  @ApiOperation({
    summary: 'Get blocks by commerce grouped by day and queue',
    description: 'Retrieves time blocks for all queues in a commerce, organized by day and queue',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({
    status: 200,
    description: 'Blocks grouped by day and queue',
    schema: { type: 'object' },
  })
  public async getQueueBlockDetailsByDayByCommerceId(
    @Param() params: any
  ): Promise<Record<string, Record<string, Block[]>>> {
    const { commerceId } = params;
    return this.blockService.getQueueBlockDetailsByDayByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/specific-day/commerceId/:commerceId/queueId/:queueId')
  @ApiOperation({
    summary: 'Get blocks for specific day by commerce and queue',
    description: 'Retrieves time blocks for a specific day, commerce, and queue',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'queueId', description: 'Queue ID', example: 'queue-123' })
  @ApiResponse({
    status: 200,
    description: 'Blocks for specific day',
    schema: {
      type: 'object',
      additionalProperties: { type: 'array', items: { $ref: '#/components/schemas/Block' } },
    },
  })
  public async getQueueBlockDetailsBySpecificDayByCommerceId(
    @Param() params: any
  ): Promise<Record<string, Block[]>> {
    const { commerceId, queueId } = params;
    return this.blockService.getQueueBlockDetailsBySpecificDayByCommerceId(commerceId, queueId);
  }
}
