import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { User } from 'src/auth/user.decorator';

import { SurveyPersonalized } from './model/survey-personalized.entity';
import { SurveyPersonalizedService } from './survey-personalized.service';

@ApiTags('survey-personalized')
@Controller('survey-personalized')
export class SurveyPersonalizedController {
  constructor(private readonly surveyPersonalizedService: SurveyPersonalizedService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get personalized survey by ID',
    description: 'Retrieves a personalized survey template by its unique identifier',
  })
  @ApiParam({
    name: 'id',
    description: 'Survey personalized ID',
    example: 'survey-personalized-123',
  })
  @ApiResponse({ status: 200, description: 'Survey personalized found', type: SurveyPersonalized })
  @ApiResponse({ status: 404, description: 'Survey personalized not found' })
  public async getSurveyPersonalizedById(@Param() params: any): Promise<SurveyPersonalized> {
    const { id } = params;
    return this.surveyPersonalizedService.getSurveyPersonalizedById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({
    summary: 'Get all personalized surveys',
    description: 'Retrieves a list of all personalized survey templates',
  })
  @ApiResponse({
    status: 200,
    description: 'List of personalized surveys',
    type: [SurveyPersonalized],
  })
  public async getSurveysPersonalized(): Promise<SurveyPersonalized[]> {
    return this.surveyPersonalizedService.getSurveysPersonalized();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId')
  @ApiOperation({
    summary: 'Get personalized surveys by commerce',
    description: 'Retrieves all personalized surveys for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({
    status: 200,
    description: 'List of personalized surveys',
    type: [SurveyPersonalized],
  })
  public async getSurveysPersonalizedByCommerceId(
    @Param() params: any
  ): Promise<SurveyPersonalized[]> {
    const { commerceId } = params;
    return this.surveyPersonalizedService.getSurveysPersonalizedByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/queueId/:queueId')
  @ApiOperation({
    summary: 'Get personalized surveys by queue',
    description: 'Retrieves personalized surveys for a specific queue',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'queueId', description: 'Queue ID', example: 'queue-123' })
  @ApiResponse({
    status: 200,
    description: 'List of personalized surveys',
    type: [SurveyPersonalized],
  })
  public async getSurveysPersonalizedByQueueId(
    @Param() params: any
  ): Promise<SurveyPersonalized[]> {
    const { commerceId, queueId } = params;
    return this.surveyPersonalizedService.getSurveysPersonalizedByQueueId(commerceId, queueId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new personalized survey',
    description: 'Creates a new personalized survey template',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        commerceId: { type: 'string', example: 'commerce-123' },
        type: { type: 'string', example: 'SIMPLE_CSAT' },
        attentionDefault: { type: 'boolean' },
        hasCSAT: { type: 'boolean' },
        hasNPS: { type: 'boolean' },
        hasMessage: { type: 'boolean' },
        questions: { type: 'array' },
        queueId: { type: 'string' },
      },
      required: ['commerceId', 'type'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Personalized survey created successfully',
    type: SurveyPersonalized,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createSurveyPersonalized(@Body() body: any): Promise<SurveyPersonalized> {
    const { commerceId, type, attentionDefault, hasCSAT, hasNPS, hasMessage, questions, queueId } =
      body;
    return this.surveyPersonalizedService.createSurveyPersonalized(
      commerceId,
      type,
      attentionDefault,
      hasCSAT,
      hasNPS,
      hasMessage,
      questions,
      queueId
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update personalized survey',
    description: 'Updates a personalized survey template',
  })
  @ApiParam({
    name: 'id',
    description: 'Survey personalized ID',
    example: 'survey-personalized-123',
  })
  @ApiBody({ type: SurveyPersonalized })
  @ApiResponse({
    status: 200,
    description: 'Personalized survey updated successfully',
    type: SurveyPersonalized,
  })
  @ApiResponse({ status: 404, description: 'Survey personalized not found' })
  public async updateSurveyPersonalized(
    @User() user,
    @Param() params: any,
    @Body() body: SurveyPersonalized
  ): Promise<SurveyPersonalized> {
    const { id } = params;
    const {
      type,
      active,
      available,
      attentionDefault,
      hasCSAT,
      hasNPS,
      hasMessage,
      questions,
      queueId,
    } = body;
    return this.surveyPersonalizedService.updateSurveyPersonalized(
      user,
      type,
      id,
      active,
      available,
      attentionDefault,
      hasCSAT,
      hasNPS,
      hasMessage,
      questions,
      queueId
    );
  }
}
