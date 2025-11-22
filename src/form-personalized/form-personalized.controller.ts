import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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

import { FormPersonalizedService } from './form-personalized.service';
import { FormPersonalized } from './model/form-personalized.entity';

@ApiTags('form-personalized')
@Controller('form-personalized')
export class FormPersonalizedController {
  constructor(private readonly formPersonalizedService: FormPersonalizedService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get personalized form by ID',
    description: 'Retrieves a personalized form template by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Form personalized ID', example: 'form-personalized-123' })
  @ApiResponse({ status: 200, description: 'Form personalized found', type: FormPersonalized })
  @ApiResponse({ status: 404, description: 'Form personalized not found' })
  public async getFormPersonalizedById(@Param() params: any): Promise<FormPersonalized> {
    const { id } = params;
    return this.formPersonalizedService.getFormPersonalizedById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({
    summary: 'Get all personalized forms',
    description: 'Retrieves a list of all personalized form templates',
  })
  @ApiResponse({ status: 200, description: 'List of personalized forms', type: [FormPersonalized] })
  public async getFormsPersonalized(): Promise<FormPersonalized[]> {
    return this.formPersonalizedService.getFormsPersonalized();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId')
  @ApiOperation({
    summary: 'Get personalized forms by commerce',
    description: 'Retrieves all personalized forms for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of personalized forms', type: [FormPersonalized] })
  public async getFormsPersonalizedByCommerceId(@Param() params: any): Promise<FormPersonalized[]> {
    const { commerceId } = params;
    return this.formPersonalizedService.getFormsPersonalizedByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/queueId/:queueId')
  @ApiOperation({
    summary: 'Get personalized forms by queue',
    description: 'Retrieves personalized forms for a specific queue',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'queueId', description: 'Queue ID', example: 'queue-123' })
  @ApiResponse({ status: 200, description: 'List of personalized forms', type: [FormPersonalized] })
  public async getFormsPersonalizedByQueueId(@Param() params: any): Promise<FormPersonalized[]> {
    const { commerceId, queueId } = params;
    return this.formPersonalizedService.getFormsPersonalizedByQueueId(commerceId, queueId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/type/:type')
  @ApiOperation({
    summary: 'Get personalized forms by commerce and type',
    description: 'Retrieves personalized forms filtered by commerce and type',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'type', description: 'Form type', example: 'MEDICAL' })
  @ApiResponse({ status: 200, description: 'List of personalized forms', type: [FormPersonalized] })
  public async getFormsPersonalizedByCommerceIdAndType(
    @Param() params: any
  ): Promise<FormPersonalized[]> {
    const { commerceId, type } = params;
    return this.formPersonalizedService.getFormsPersonalizedByCommerceIdAndType(commerceId, type);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new personalized form',
    description: 'Creates a new personalized form template',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        commerceId: { type: 'string', example: 'commerce-123' },
        type: { type: 'string', example: 'MEDICAL' },
        questions: { type: 'array' },
        queueId: { type: 'string' },
        servicesId: { type: 'array', items: { type: 'string' } },
      },
      required: ['commerceId', 'type', 'questions'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Personalized form created successfully',
    type: FormPersonalized,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createFormPersonalized(@Body() body: any): Promise<FormPersonalized> {
    const { commerceId, type, questions, queueId, servicesId } = body;
    return this.formPersonalizedService.createFormPersonalized(
      commerceId,
      type,
      questions,
      queueId,
      servicesId
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update personalized form',
    description: 'Updates a personalized form template',
  })
  @ApiParam({ name: 'id', description: 'Form personalized ID', example: 'form-personalized-123' })
  @ApiBody({ type: FormPersonalized })
  @ApiResponse({
    status: 200,
    description: 'Personalized form updated successfully',
    type: FormPersonalized,
  })
  @ApiResponse({ status: 404, description: 'Form personalized not found' })
  public async updateFormPersonalized(
    @User() user,
    @Param() params: any,
    @Body() body: FormPersonalized
  ): Promise<FormPersonalized> {
    const { id } = params;
    const { type, active, available, questions, queueId, servicesId } = body;
    return this.formPersonalizedService.updateFormPersonalized(
      user,
      type,
      id,
      active,
      available,
      questions,
      queueId,
      servicesId
    );
  }
}
