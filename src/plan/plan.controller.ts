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

import { Plan } from './model/plan.entity';
import { PlanService } from './plan.service';

@ApiTags('plan')
@Controller('plan')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get plan by ID',
    description: 'Retrieves a subscription plan by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Plan ID', example: 'plan-123' })
  @ApiResponse({ status: 200, description: 'Plan found', type: Plan })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  public async getPlanById(@Param() params: any): Promise<Plan> {
    const { id } = params;
    return this.planService.getPlanById(id);
  }

  @Get('/')
  @ApiOperation({
    summary: 'Get all plans',
    description: 'Retrieves a list of all subscription plans',
  })
  @ApiResponse({ status: 200, description: 'List of plans', type: [Plan] })
  public async getPlan(): Promise<Plan[]> {
    return this.planService.getAll();
  }

  @Get('/online/country/:country')
  @ApiOperation({
    summary: 'Get online plans by country',
    description: 'Retrieves all online-available plans for a specific country',
  })
  @ApiParam({ name: 'country', description: 'Country code', example: 'CL' })
  @ApiResponse({ status: 200, description: 'List of online plans', type: [Plan] })
  public async getOnlinePlans(@Param() params: any): Promise<Plan[]> {
    const { country } = params;
    return this.planService.getOnlinePlans(country);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/init')
  @ApiOperation({
    summary: 'Initialize plans',
    description: 'Initializes default subscription plans in the system',
  })
  @ApiResponse({ status: 201, description: 'Plans initialized successfully', type: [Plan] })
  public async initPlan(@User() user): Promise<Plan[]> {
    return this.planService.initPlan(user);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new plan', description: 'Creates a new subscription plan' })
  @ApiBody({ type: Plan })
  @ApiResponse({ status: 201, description: 'Plan created successfully', type: Plan })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createPlan(@User() user, @Body() body: Plan): Promise<Plan> {
    const {
      name,
      country,
      description,
      price,
      periodicity,
      order,
      online,
      onlinePrice,
      saving,
      onlineSaving,
      productType,
    } = body;
    return this.planService.createPlan(
      user,
      name,
      country,
      description,
      price,
      periodicity,
      order,
      online,
      onlinePrice,
      saving,
      onlineSaving,
      productType
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/permission')
  @ApiOperation({
    summary: 'Update plan permission',
    description: 'Updates a specific permission for a plan',
  })
  @ApiParam({ name: 'id', description: 'Plan ID', example: 'plan-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'permission-name' },
        value: { type: 'boolean', example: true },
      },
      required: ['name', 'value'],
    },
  })
  @ApiResponse({ status: 200, description: 'Permission updated successfully', type: Plan })
  public async updatePlanPermission(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Plan> {
    const { id } = params;
    const { name, value } = body;
    return this.planService.updatePlanPermission(user, id, name, value);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update plan configurations',
    description: 'Updates the configuration of an existing plan',
  })
  @ApiParam({ name: 'id', description: 'Plan ID', example: 'plan-123' })
  @ApiBody({ type: Plan })
  @ApiResponse({ status: 200, description: 'Plan updated successfully', type: Plan })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  public async updatePlanConfigurations(
    @User() user,
    @Param() params: any,
    @Body() body: Plan
  ): Promise<Plan> {
    const { id } = params;
    const {
      name,
      country,
      description,
      periodicity,
      order,
      price,
      active,
      online,
      onlinePrice,
      saving,
      onlineSaving,
    } = body;
    return this.planService.updatePlanConfigurations(
      user,
      id,
      name,
      country,
      description,
      periodicity,
      order,
      price,
      active,
      online,
      onlinePrice,
      saving,
      onlineSaving
    );
  }
}
