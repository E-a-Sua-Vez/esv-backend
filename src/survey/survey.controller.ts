import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SurveyService } from './survey.service';
import { Survey } from './model/survey.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('survey')
export class SurveyController {
    constructor(private readonly surveyService: SurveyService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getSurveyById(@Param() params: any): Promise<Survey> {
        const { id } = params;
        return this.surveyService.getSurveyById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getSurveys(): Promise<Survey[]> {
        return this.surveyService.getSurveys();
    }

    @UseGuards(AuthGuard)
    @Post()
    public async createSurvey(@Body() body: any): Promise<Survey> {
        const { attentionId, type, rating, nps, message, personalizedId, questions, answers } = body;
        return this.surveyService.createSurvey(attentionId, type, rating, nps, message, personalizedId, questions, answers);
    }

    @UseGuards(AuthGuard)
    @Patch('contact/:id')
    public async contactSurvey(@User() user, @Param() params: any): Promise<Survey> {
        const { id } = params;
        return this.surveyService.contactSurvey(user, id);
    }
}