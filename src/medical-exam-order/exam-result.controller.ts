import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/user.decorator';

import { CreateExamResultDto } from './dto/create-exam-result.dto';
import { ExamResultService } from './exam-result.service';
import { ExamResult } from './model/medical-exam-order.entity';

@ApiTags('Exam Result')
@Controller('exam-result')
@UseGuards(AuthGuard)
@ApiBearerAuth('JWT-auth')
export class ExamResultController {
  constructor(private readonly examResultService: ExamResultService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create structured exam result' })
  @ApiResponse({ status: 201, description: 'Exam result created', type: ExamResult })
  async createStructuredResult(
    @User() user: string,
    @Body() dto: CreateExamResultDto
  ): Promise<ExamResult> {
    return this.examResultService.createStructuredResult(user, dto);
  }

  @Get(':examOrderId/compare/:resultId')
  @ApiOperation({ summary: 'Compare result with previous results' })
  @ApiResponse({ status: 200, description: 'Comparison data' })
  async compareWithPrevious(
    @Param('examOrderId') examOrderId: string,
    @Param('resultId') resultId: string
  ): Promise<{ comparison: string; variations: Array<{ parameter: string; variation: number }> }> {
    return this.examResultService.compareWithPreviousResult(examOrderId, resultId);
  }
}
