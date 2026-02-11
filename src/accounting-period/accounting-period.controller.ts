import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
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

import { AccountingPeriodService } from './accounting-period.service';
import { AccountingPeriod } from './model/accounting-period.entity';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';
import { ClosePeriodDto } from './dto/close-period.dto';
import { ReopenPeriodDto } from './dto/reopen-period.dto';
import { LockPeriodDto } from './dto/lock-period.dto';

@ApiTags('accounting-period')
@Controller('accounting-period')
export class AccountingPeriodController {
  constructor(private readonly accountingPeriodService: AccountingPeriodService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId')
  @ApiOperation({
    summary: 'Get all accounting periods for a commerce',
    description: 'Retrieves all accounting periods ordered by start date descending with pagination support',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'Periods found', type: [AccountingPeriod] })
  public async getPeriodsByCommerce(
    @Param('commerceId') commerceId: string,
    @Query('searchText') searchText?: string,
    @Query('status') status?: string,
    @Query('year') year?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<AccountingPeriod[]> {
    console.log('🔍 GET /accounting-period/commerce/:commerceId - Filters received:', {
      commerceId,
      searchText,
      status,
      year,
      startDate,
      endDate,
      limit,
      offset,
    });
    return this.accountingPeriodService.getPeriodsByCommerce(
      commerceId,
      searchText,
      status,
      year,
      startDate,
      endDate,
      limit ? parseInt(limit) : undefined,
      offset ? parseInt(offset) : undefined,
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get accounting period by ID',
    description: 'Retrieves a specific accounting period by its ID',
  })
  @ApiParam({ name: 'id', description: 'Period ID', example: 'period-123' })
  @ApiResponse({ status: 200, description: 'Period found', type: AccountingPeriod })
  @ApiResponse({ status: 404, description: 'Period not found' })
  public async getPeriodById(@Param('id') id: string): Promise<AccountingPeriod> {
    return this.accountingPeriodService.getPeriodById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId/current')
  @ApiOperation({
    summary: 'Get current open period',
    description: 'Retrieves the current open accounting period for a commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'Current period found', type: AccountingPeriod })
  @ApiResponse({ status: 404, description: 'No open period found' })
  public async getCurrentOpenPeriod(
    @Param('commerceId') commerceId: string
  ): Promise<AccountingPeriod | null> {
    return this.accountingPeriodService.getCurrentOpenPeriod(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id/summary')
  @ApiOperation({
    summary: 'Get period summary with totals',
    description: 'Retrieves calculated totals for a period (real-time if open, stored if closed)',
  })
  @ApiParam({ name: 'id', description: 'Period ID', example: 'period-123' })
  @ApiResponse({ status: 200, description: 'Summary calculated' })
  public async getPeriodSummary(@Param('id') id: string) {
    return this.accountingPeriodService.getPeriodSummary(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @ApiOperation({
    summary: 'Create new accounting period',
    description: 'Creates a new accounting period. Only one period can be OPEN at a time.',
  })
  @ApiBody({ type: CreateAccountingPeriodDto })
  @ApiResponse({ status: 201, description: 'Period created', type: AccountingPeriod })
  @ApiResponse({ status: 400, description: 'Invalid data or period overlap' })
  @HttpCode(HttpStatus.CREATED)
  public async createPeriod(
    @Body() dto: CreateAccountingPeriodDto,
    @User() user: any
  ): Promise<AccountingPeriod> {
    dto.createdBy = user.email || user.id;
    return this.accountingPeriodService.createPeriod(dto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/close')
  @ApiOperation({
    summary: 'Close accounting period',
    description: 'Closes a period, calculates totals, and marks all transactions as closed',
  })
  @ApiParam({ name: 'id', description: 'Period ID', example: 'period-123' })
  @ApiBody({ type: ClosePeriodDto })
  @ApiResponse({ status: 200, description: 'Period closed', type: AccountingPeriod })
  @ApiResponse({ status: 400, description: 'Cannot close period (e.g., pending transactions)' })
  public async closePeriod(
    @Param('id') id: string,
    @Body() dto: ClosePeriodDto,
    @User() user: any
  ): Promise<AccountingPeriod> {
    dto.closedBy = user.email || user.id;
    return this.accountingPeriodService.closePeriod(id, dto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/reopen')
  @ApiOperation({
    summary: 'Reopen closed period',
    description: 'Reopens a closed period. Cannot reopen LOCKED periods or if later periods are closed.',
  })
  @ApiParam({ name: 'id', description: 'Period ID', example: 'period-123' })
  @ApiBody({ type: ReopenPeriodDto })
  @ApiResponse({ status: 200, description: 'Period reopened', type: AccountingPeriod })
  @ApiResponse({ status: 400, description: 'Cannot reopen period' })
  public async reopenPeriod(
    @Param('id') id: string,
    @Body() dto: ReopenPeriodDto,
    @User() user: any
  ): Promise<AccountingPeriod> {
    dto.reopenedBy = user.email || user.id;
    return this.accountingPeriodService.reopenPeriod(id, dto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/lock')
  @ApiOperation({
    summary: 'Lock accounting period',
    description: 'Locks a closed period permanently (cannot be reopened). Use for audited periods.',
  })
  @ApiParam({ name: 'id', description: 'Period ID', example: 'period-123' })
  @ApiBody({ type: LockPeriodDto })
  @ApiResponse({ status: 200, description: 'Period locked', type: AccountingPeriod })
  @ApiResponse({ status: 400, description: 'Cannot lock period (must be CLOSED first)' })
  public async lockPeriod(
    @Param('id') id: string,
    @Body() dto: LockPeriodDto,
    @User() user: any
  ): Promise<AccountingPeriod> {
    dto.lockedBy = user.email || user.id;
    return this.accountingPeriodService.lockPeriod(id, dto);
  }
}
