import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
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
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

import { CreateMedicalTemplateDto } from './dto/create-medical-template.dto';
import { ProcessTemplateDto } from './dto/process-template.dto';
import { SearchTemplateDto } from './dto/search-template.dto';
import { UpdateMedicalTemplateDto } from './dto/update-medical-template.dto';
import { MedicalTemplateService } from './medical-template.service';
import { MedicalTemplate } from './model/medical-template.entity';

@ApiTags('medical-template')
@Controller('medical-template')
export class MedicalTemplateController {
  constructor(private readonly templateService: MedicalTemplateService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new medical template',
    description: 'Creates a new template for medical records',
  })
  @ApiBody({ type: CreateMedicalTemplateDto })
  @ApiResponse({
    status: 201,
    description: 'Template created successfully',
    type: MedicalTemplate,
  })
  async createTemplate(
    @User() user,
    @Body() createDto: CreateMedicalTemplateDto
  ): Promise<MedicalTemplate> {
    return this.templateService.createTemplate(user, createDto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a medical template',
    description: 'Updates an existing medical template',
  })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiBody({ type: UpdateMedicalTemplateDto })
  @ApiResponse({
    status: 200,
    description: 'Template updated successfully',
    type: MedicalTemplate,
  })
  async updateTemplate(
    @User() user,
    @Param('id') id: string,
    @Body() updateDto: UpdateMedicalTemplateDto
  ): Promise<MedicalTemplate> {
    return this.templateService.updateTemplate(user, id, updateDto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get template by ID',
    description: 'Retrieves a medical template by its ID',
  })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({
    status: 200,
    description: 'Template found',
    type: MedicalTemplate,
  })
  async getTemplateById(@Param('id') id: string): Promise<MedicalTemplate> {
    return this.templateService.getTemplateById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId/doctor/:doctorId/search')
  @ApiOperation({
    summary: 'Search templates',
    description: 'Searches for medical templates with filters',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID' })
  @ApiResponse({
    status: 200,
    description: 'List of templates',
  })
  async searchTemplates(
    @Param('commerceId') commerceId: string,
    @Param('doctorId') doctorId: string,
    @Query() searchDto: SearchTemplateDto
  ) {
    return this.templateService.searchTemplates(commerceId, doctorId, searchDto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process template',
    description: 'Processes a template by replacing variables with values',
  })
  @ApiBody({ type: ProcessTemplateDto })
  @ApiResponse({
    status: 200,
    description: 'Template processed successfully',
    schema: {
      type: 'object',
      properties: {
        processedContent: { type: 'string' },
      },
    },
  })
  async processTemplate(@Body() processDto: ProcessTemplateDto) {
    return this.templateService.processTemplate(processDto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/favorite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Toggle favorite',
    description: 'Marks or unmarks a template as favorite',
  })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({
    status: 200,
    description: 'Favorite status toggled',
    type: MedicalTemplate,
  })
  async toggleFavorite(@User() user, @Param('id') id: string): Promise<MedicalTemplate> {
    return this.templateService.toggleFavorite(user, id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete('/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete template',
    description: 'Soft deletes a medical template',
  })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({
    status: 204,
    description: 'Template deleted successfully',
  })
  async deleteTemplate(@User() user, @Param('id') id: string): Promise<void> {
    return this.templateService.deleteTemplate(user, id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId/doctor/:doctorId/most-used')
  @ApiOperation({
    summary: 'Get most used templates',
    description: 'Retrieves the most frequently used templates',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of templates to return' })
  @ApiResponse({
    status: 200,
    description: 'List of most used templates',
    type: [MedicalTemplate],
  })
  async getMostUsedTemplates(
    @Param('commerceId') commerceId: string,
    @Param('doctorId') doctorId: string,
    @Query('limit') limit?: number
  ): Promise<MedicalTemplate[]> {
    return this.templateService.getMostUsedTemplates(commerceId, doctorId, limit);
  }
}
