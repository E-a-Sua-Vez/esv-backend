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
import { Payment } from 'src/payment/model/payment.entity';

import { PlanActivation } from './model/plan-activation.entity';
import { PlanActivationService } from './plan-activation.service';

@ApiTags('plan-activation')
@Controller('plan-activation')
export class PlanActivationController {
  constructor(private readonly planActivationService: PlanActivationService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get plan activation by ID',
    description: 'Retrieves a plan activation by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Plan activation ID', example: 'plan-activation-123' })
  @ApiResponse({ status: 200, description: 'Plan activation found', type: PlanActivation })
  @ApiResponse({ status: 404, description: 'Plan activation not found' })
  public async getPlanActivationById(@Param() params: any): Promise<PlanActivation> {
    const { id } = params;
    return this.planActivationService.getPlanActivationById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('businessId/:id')
  @ApiOperation({
    summary: 'Get plan activations by business ID',
    description: 'Retrieves all plan activations for a specific business',
  })
  @ApiParam({ name: 'id', description: 'Business ID', example: 'business-123' })
  @ApiResponse({ status: 200, description: 'List of plan activations', type: [PlanActivation] })
  public async getPlanActivationByBusinessId(@Param() params: any): Promise<PlanActivation[]> {
    const { id } = params;
    return this.planActivationService.getPlanActivationByBusinessId(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/validated/:validated/businessId/:id')
  @ApiOperation({
    summary: 'Get validated plan activation by business',
    description: 'Retrieves a validated plan activation for a business',
  })
  @ApiParam({ name: 'validated', description: 'Validation status', example: 'true' })
  @ApiParam({ name: 'id', description: 'Business ID', example: 'business-123' })
  @ApiResponse({
    status: 200,
    description: 'Validated plan activation found',
    type: PlanActivation,
  })
  public async getValidatedPlanActivationByBusinessId(
    @Param() params: any
  ): Promise<PlanActivation> {
    const { id, validated } = params;
    return this.planActivationService.getValidatedPlanActivationByBusinessId(id, validated);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/validated/:validated')
  @ApiOperation({
    summary: 'Get plan activations by validation status',
    description: 'Retrieves all plan activations filtered by validation status',
  })
  @ApiParam({ name: 'validated', description: 'Validation status', example: 'true' })
  @ApiResponse({ status: 200, description: 'List of plan activations', type: [PlanActivation] })
  public async getValidatedPlanActivation(@Param() params: any): Promise<PlanActivation[]> {
    const { validated } = params;
    return this.planActivationService.getValidatedPlanActivation(validated);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new plan activation',
    description: 'Creates a new plan activation request',
  })
  @ApiBody({ type: PlanActivation })
  @ApiResponse({
    status: 201,
    description: 'Plan activation created successfully',
    type: PlanActivation,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createPlanActivation(
    @User() user,
    @Body() body: PlanActivation
  ): Promise<PlanActivation> {
    const { businessId, planId, planPayedCopy, renewable, origin, paymentMethod, termsAccepted } =
      body;
    return this.planActivationService.createPlanActivation(
      user,
      businessId,
      planId,
      planPayedCopy,
      renewable,
      origin,
      paymentMethod,
      termsAccepted
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/validate/:id')
  @ApiOperation({
    summary: 'Validate plan activation',
    description: 'Validates a plan activation with payment information',
  })
  @ApiParam({ name: 'id', description: 'Plan activation ID', example: 'plan-activation-123' })
  @ApiBody({ type: Payment })
  @ApiResponse({
    status: 200,
    description: 'Plan activation validated successfully',
    type: PlanActivation,
  })
  @ApiResponse({ status: 404, description: 'Plan activation not found' })
  public async validate(
    @User() user,
    @Param() params: any,
    @Body() body: Payment
  ): Promise<PlanActivation> {
    const { id } = params;
    const { businessId, planId, amount, paymentNumber, paymentDate, bankData, method } = body;
    return this.planActivationService.validate(
      user,
      id,
      businessId,
      planId,
      amount,
      paymentNumber,
      paymentDate,
      bankData,
      method
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/desactivate/:id')
  @ApiOperation({
    summary: 'Deactivate plan',
    description: 'Deactivates an active plan activation',
  })
  @ApiParam({ name: 'id', description: 'Plan activation ID', example: 'plan-activation-123' })
  @ApiResponse({ status: 200, description: 'Plan deactivated successfully', type: PlanActivation })
  @ApiResponse({ status: 404, description: 'Plan activation not found' })
  public async desactivate(@User() user, @Param() params: any): Promise<PlanActivation> {
    const { id } = params;
    return this.planActivationService.desactivate(user, id);
  }
}
