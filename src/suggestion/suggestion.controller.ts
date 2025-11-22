import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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

import { Suggestion } from './suggestion.entity';
import { SuggestionService } from './suggestion.service';

@ApiTags('suggestion')
@Controller('suggestion')
export class SuggestionController {
  constructor(private readonly suggestionService: SuggestionService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get suggestion by ID',
    description: 'Retrieves a suggestion by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Suggestion ID', example: 'suggestion-123' })
  @ApiResponse({ status: 200, description: 'Suggestion found', type: Suggestion })
  @ApiResponse({ status: 404, description: 'Suggestion not found' })
  public async getSuggestionById(@Param() params: any): Promise<Suggestion> {
    const { id } = params;
    return this.suggestionService.getSuggestionById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new suggestion',
    description: 'Creates a new user suggestion or feedback (public endpoint)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', example: 'FEATURE_REQUEST' },
        comment: { type: 'string', example: 'User feedback comment' },
        userId: { type: 'string', example: 'user-123' },
        userType: { type: 'string', example: 'CLIENT' },
      },
      required: ['type', 'comment'],
    },
  })
  @ApiResponse({ status: 201, description: 'Suggestion created successfully', type: Suggestion })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createSuggestion(@Body() body: any): Promise<Suggestion> {
    const { type, comment, userId, userType } = body;
    return this.suggestionService.createSuggestion(type, comment, userId, userType);
  }
}
