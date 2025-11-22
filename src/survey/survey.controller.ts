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

import { Survey } from './model/survey.entity';
import { SurveyService } from './survey.service';

@ApiTags('survey')
@Controller('survey')
export class SurveyController {
  constructor(private readonly surveyService: SurveyService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get survey by ID',
    description: 'Retrieves a survey by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Survey ID', example: 'survey-123' })
  @ApiResponse({ status: 200, description: 'Survey found', type: Survey })
  @ApiResponse({ status: 404, description: 'Survey not found' })
  public async getSurveyById(@Param() params: any): Promise<Survey> {
    const { id } = params;
    return this.surveyService.getSurveyById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({ summary: 'Get all surveys', description: 'Retrieves a list of all surveys' })
  @ApiResponse({ status: 200, description: 'List of surveys', type: [Survey] })
  public async getSurveys(): Promise<Survey[]> {
    return this.surveyService.getSurveys();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new survey', description: 'Creates a new survey response' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        attentionId: { type: 'string', example: 'attention-123' },
        type: { type: 'string', example: 'SIMPLE_CSAT' },
        rating: { type: 'number', example: 5 },
        nps: { type: 'number', example: 9 },
        message: { type: 'string', example: 'Great service!' },
        personalizedId: { type: 'string' },
        questions: { type: 'array' },
        answers: { type: 'array' },
      },
      required: ['attentionId', 'type'],
    },
  })
  @ApiResponse({ status: 201, description: 'Survey created successfully', type: Survey })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createSurvey(@Body() body: any): Promise<Survey> {
    const { attentionId, type, rating, nps, message, personalizedId, questions, answers } = body;
    return this.surveyService.createSurvey(
      attentionId,
      type,
      rating,
      nps,
      message,
      personalizedId,
      questions,
      answers
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('contact/:id')
  @ApiOperation({
    summary: 'Contact survey respondent',
    description: 'Marks a survey for follow-up contact',
  })
  @ApiParam({ name: 'id', description: 'Survey ID', example: 'survey-123' })
  @ApiResponse({ status: 200, description: 'Survey marked for contact', type: Survey })
  @ApiResponse({ status: 404, description: 'Survey not found' })
  public async contactSurvey(@User() user, @Param() params: any): Promise<Survey> {
    const { id } = params;
    return this.surveyService.contactSurvey(user, id);
  }
}
