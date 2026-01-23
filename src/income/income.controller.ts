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

import { IncomeService } from './income.service';
import { Income } from './model/income.entity';

@ApiTags('income')
@Controller('income')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get income by ID',
    description: 'Retrieves an income record by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Income ID', example: 'income-123' })
  @ApiResponse({ status: 200, description: 'Income found', type: Income })
  @ApiResponse({ status: 404, description: 'Income not found' })
  public async getIncomeById(@Param() params: any): Promise<Income> {
    const { id } = params;
    return this.incomeService.getIncomeById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({
    summary: 'Get all incomes',
    description: 'Retrieves a list of all income records',
  })
  @ApiResponse({ status: 200, description: 'List of incomes', type: [Income] })
  public async getIncomes(): Promise<Income[]> {
    return this.incomeService.getIncomes();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId')
  @ApiOperation({
    summary: 'Get incomes by commerce',
    description: 'Retrieves all income records for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of incomes', type: [Income] })
  public async getIncomeByCommerce(@Param() params: any): Promise<Income[]> {
    const { commerceId } = params;
    return this.incomeService.getIncomeByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/packageId/:packageId')
  @ApiOperation({
    summary: 'Get pending incomes by package',
    description: 'Retrieves pending income records for a specific package',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'packageId', description: 'Package ID', example: 'package-123' })
  @ApiResponse({ status: 200, description: 'List of pending incomes', type: [Income] })
  public async getPendingIncomeByPackage(@Param() params: any): Promise<Income[]> {
    const { commerceId, packageId } = params;
    return this.incomeService.getPendingIncomeByPackage(commerceId, packageId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/packageId/:packageId/all')
  @ApiOperation({
    summary: 'Get all incomes by package',
    description: 'Retrieves all income records (pending and confirmed) for a specific package',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'packageId', description: 'Package ID', example: 'package-123' })
  @ApiResponse({ status: 200, description: 'List of all incomes', type: [Income] })
  public async getAllIncomesByPackage(@Param() params: any): Promise<Income[]> {
    const { commerceId, packageId } = params;
    return this.incomeService.getAllIncomesByPackage(commerceId, packageId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/list/:ids')
  @ApiOperation({
    summary: 'Get incomes by IDs',
    description: 'Retrieves multiple income records by their IDs (comma-separated)',
  })
  @ApiParam({
    name: 'ids',
    description: 'Comma-separated income IDs',
    example: 'income-1,income-2,income-3',
  })
  @ApiResponse({ status: 200, description: 'List of incomes', type: [Income] })
  public async getIncomesById(@Param() params: any): Promise<Income[]> {
    const { ids } = params;
    return this.incomeService.getIncomesById(ids.split(','));
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new income', description: 'Creates a new income record' })
  @ApiBody({ type: Income })
  @ApiResponse({ status: 201, description: 'Income created successfully', type: Income })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createIncome(@User() user, @Body() body: Income): Promise<Income> {
    const {
      commerceId,
      bookingId,
      attentionId,
      clientId,
      type,
      amount,
      totalAmount,
      installments,
      paymentMethod,
      incomeInfo,
      status,
      packageId,
      commission,
      comment,
      fiscalNote,
      promotionalCode,
      transactionId,
      bankEntity,
    } = body;
    return this.incomeService.createIncome(
      user,
      commerceId,
      type,
      status,
      bookingId,
      attentionId,
      clientId,
      packageId,
      amount,
      totalAmount,
      installments,
      paymentMethod,
      commission,
      comment,
      fiscalNote,
      promotionalCode,
      transactionId,
      bankEntity,
      incomeInfo
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update income',
    description: 'Updates income information and configuration',
  })
  @ApiParam({ name: 'id', description: 'Income ID', example: 'income-123' })
  @ApiBody({ type: Income })
  @ApiResponse({ status: 200, description: 'Income updated successfully', type: Income })
  @ApiResponse({ status: 404, description: 'Income not found' })
  public async updateIncome(
    @User() user,
    @Param() params: any,
    @Body() body: Income
  ): Promise<Income> {
    const { id } = params;
    const { incomeInfo, paymentConfirmation, status } = body;
    return this.incomeService.updateIncomeConfigurations(
      user,
      id,
      incomeInfo,
      paymentConfirmation,
      status
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/confirm/:id')
  @ApiOperation({
    summary: 'Confirm pending income',
    description: 'Confirms a pending income record',
  })
  @ApiParam({ name: 'id', description: 'Income ID', example: 'income-123' })
  @ApiResponse({ status: 200, description: 'Income confirmed successfully', type: Income })
  @ApiResponse({ status: 404, description: 'Income not found' })
  public async confirmPendingIncome(@User() user, @Param() params: any): Promise<Income> {
    const { id } = params;
    return this.incomeService.confirmPendingIncome(user, id);
  }
}
