import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SuggestionService } from './suggestion.service';
import { Suggestion } from './suggestion.entity';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('suggestion')
export class SuggestionController {
    constructor(private readonly suggestionService: SuggestionService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getSuggestionById(@Param() params: any): Promise<Suggestion> {
        const { id } = params;
        return this.suggestionService.getSuggestionById(id);
    }

    @Post()
    public async createSuggestion(@Body() body: any): Promise<Suggestion> {
        const { type, comment, userId, userType } = body;
        return this.suggestionService.createSuggestion(type, comment, userId, userType);
    }
}