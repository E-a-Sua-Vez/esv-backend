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

import { Outcome } from './model/outcome.entity';
import { OutcomeService } from './outcome.service';

@ApiTags('outcome')
@Controller('outcome')
export class OutcomeController {
  constructor(private readonly outcomeService: OutcomeService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get outcome by ID',
    description: 'Retrieves an outcome record by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Outcome ID', example: 'outcome-123' })
  @ApiResponse({ status: 200, description: 'Outcome found', type: Outcome })
  @ApiResponse({ status: 404, description: 'Outcome not found' })
  public async getOutcomeById(@Param() params: any): Promise<Outcome> {
    const { id } = params;
    return this.outcomeService.getOutcomeById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({
    summary: 'Get all outcomes',
    description: 'Retrieves a list of all outcome records',
  })
  @ApiResponse({ status: 200, description: 'List of outcomes', type: [Outcome] })
  public async getOutcomes(): Promise<Outcome[]> {
    return this.outcomeService.getOutcomes();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId')
  @ApiOperation({
    summary: 'Get outcomes by commerce',
    description: 'Retrieves all outcome records for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of outcomes', type: [Outcome] })
  public async getOutcomeByCommerce(@Param() params: any): Promise<Outcome[]> {
    const { commerceId } = params;
    return this.outcomeService.getOutcomeByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/packageId/:packageId')
  @ApiOperation({
    summary: 'Get pending outcomes by package',
    description: 'Retrieves pending outcome records for a specific package',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'packageId', description: 'Package ID', example: 'package-123' })
  @ApiResponse({ status: 200, description: 'List of pending outcomes', type: [Outcome] })
  public async getPendingOutcomeByPackage(@Param() params: any): Promise<Outcome[]> {
    const { commerceId, packageId } = params;
    return this.outcomeService.getPendingOutcomeByPackage(commerceId, packageId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/list/:ids')
  @ApiOperation({
    summary: 'Get outcomes by IDs',
    description: 'Retrieves multiple outcome records by their IDs (comma-separated)',
  })
  @ApiParam({
    name: 'ids',
    description: 'Comma-separated outcome IDs',
    example: 'outcome-1,outcome-2,outcome-3',
  })
  @ApiResponse({ status: 200, description: 'List of outcomes', type: [Outcome] })
  public async getOutcomesById(@Param() params: any): Promise<Outcome[]> {
    const { ids } = params;
    return this.outcomeService.getOutcomesById(ids.split(','));
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new outcome',
    description: 'Creates a new expense/outcome record',
  })
  @ApiBody({ type: Outcome })
  @ApiResponse({ status: 201, description: 'Outcome created successfully', type: Outcome })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createOutcome(@User() user, @Body() body: Outcome): Promise<Outcome> {
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
      outcomeInfo,
      status,
      packageId,
      commission,
      comment,
      fiscalNote,
      promotionalCode,
      transactionId,
      bankEntity,
      paymentType,
      paymentAmount,
      quantity,
      title,
      productId,
      productName,
      beneficiary,
      beneficiaryName,
      companyBeneficiaryId,
      date,
      code,
      expireDate,
    } = body;
    return this.outcomeService.createOutcome(
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
      outcomeInfo,
      paymentType,
      paymentAmount,
      quantity,
      title,
      productId,
      productName,
      beneficiary,
      beneficiaryName,
      companyBeneficiaryId,
      date,
      code,
      expireDate
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update outcome',
    description: 'Updates outcome information and configuration',
  })
  @ApiParam({ name: 'id', description: 'Outcome ID', example: 'outcome-123' })
  @ApiBody({ type: Outcome })
  @ApiResponse({ status: 200, description: 'Outcome updated successfully', type: Outcome })
  @ApiResponse({ status: 404, description: 'Outcome not found' })
  public async updateOutcome(
    @User() user,
    @Param() params: any,
    @Body() body: Outcome
  ): Promise<Outcome> {
    const { id } = params;
    const { outcomeInfo, paymentConfirmation, status } = body;
    return this.outcomeService.updateOutcomeConfigurations(
      user,
      id,
      outcomeInfo,
      paymentConfirmation,
      status
    );
  }
}
