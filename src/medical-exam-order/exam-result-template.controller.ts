import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/user.decorator';

import { CreateExamResultTemplateDto } from './dto/create-exam-result-template.dto';
import { ExamResultTemplateService } from './exam-result-template.service';
import { ExamResultTemplate } from './model/exam-result-template.entity';

@ApiTags('Exam Result Template')
@Controller('exam-result-template')
@UseGuards(AuthGuard)
@ApiBearerAuth('JWT-auth')
export class ExamResultTemplateController {
  constructor(private readonly templateService: ExamResultTemplateService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create exam result template' })
  @ApiResponse({ status: 201, description: 'Template created', type: ExamResultTemplate })
  async createTemplate(
    @User() user: string,
    @Body() dto: CreateExamResultTemplateDto
  ): Promise<ExamResultTemplate> {
    return this.templateService.createTemplate(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List exam result templates' })
  @ApiResponse({ status: 200, description: 'List of templates', type: [ExamResultTemplate] })
  async listTemplates(
    @Query('examCode') examCode?: string,
    @Query('commerceId') commerceId?: string,
    @Query('businessId') businessId?: string,
    @Query('activeOnly') activeOnly?: string
  ): Promise<ExamResultTemplate[]> {
    return this.templateService.listTemplates(
      examCode,
      commerceId,
      businessId,
      activeOnly !== 'false'
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiResponse({ status: 200, description: 'Template found', type: ExamResultTemplate })
  async getTemplateById(@Param('id') id: string): Promise<ExamResultTemplate> {
    return this.templateService.getTemplateById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update template' })
  @ApiResponse({ status: 200, description: 'Template updated', type: ExamResultTemplate })
  async updateTemplate(
    @User() user: string,
    @Param('id') id: string,
    @Body() updates: Partial<CreateExamResultTemplateDto>
  ): Promise<ExamResultTemplate> {
    return this.templateService.updateTemplate(user, id, updates);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete template' })
  @ApiResponse({ status: 204, description: 'Template deleted' })
  async deleteTemplate(@Param('id') id: string): Promise<void> {
    return this.templateService.deleteTemplate(id);
  }
}
