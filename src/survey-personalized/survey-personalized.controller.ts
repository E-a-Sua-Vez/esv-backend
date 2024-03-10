import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';
import { SurveyPersonalized } from './model/survey-personalized.entity';
import { SurveyPersonalizedService } from './survey-personalized.service';

@Controller('survey-personalized')
export class SurveyPersonalizedController {
    constructor(private readonly surveyPersonalizedService: SurveyPersonalizedService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getSurveyPersonalizedById(@Param() params: any): Promise<SurveyPersonalized> {
        const { id } = params;
        return this.surveyPersonalizedService.getSurveyPersonalizedById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getSurveysPersonalized(): Promise<SurveyPersonalized[]> {
        return this.surveyPersonalizedService.getSurveysPersonalized();
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId')
    public async getSurveysPersonalizedByCommerceId(@Param() params: any): Promise<SurveyPersonalized[]> {
        const { commerceId } = params;
        return this.surveyPersonalizedService.getSurveysPersonalizedByCommerceId(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/queueId/:queueId')
    public async getSurveysPersonalizedByQueueId(@Param() params: any): Promise<SurveyPersonalized[]> {
        const { commerceId, queueId } = params;
        return this.surveyPersonalizedService.getSurveysPersonalizedByQueueId(commerceId, queueId);
    }

    @UseGuards(AuthGuard)
    @Post()
    public async createSurveyPersonalized(@Body() body: any): Promise<SurveyPersonalized> {
        const { commerceId, type, attentionDefault, hasCSAT, hasNPS, hasMessage, questions, queueId } = body;
        return this.surveyPersonalizedService.createSurveyPersonalized(commerceId, type, attentionDefault, hasCSAT, hasNPS, hasMessage, questions, queueId);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateSurveyPersonalized(@User() user, @Param() params: any, @Body() body: SurveyPersonalized): Promise<SurveyPersonalized> {
        const { id } = params;
        const { type, active, available, attentionDefault, hasCSAT, hasNPS, hasMessage, questions, queueId } = body;
        return this.surveyPersonalizedService.updateSurveyPersonalized(user, type, id, active, available, attentionDefault, hasCSAT, hasNPS, hasMessage, questions, queueId);
    }
}