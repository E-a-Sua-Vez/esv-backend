import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { AuthGuard } from '../auth/auth.guard';

import { ContactFormService } from './contact-form.service';
import { ContactFormSubmission } from './model/contact-form.entity';

interface ContactFormEventData {
  data?: {
    attributes?: {
      id?: string;
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
      message?: string;
      source?: string;
      page?: string;
    };
  };
  metadata?: Record<string, unknown>;
}

@ApiTags('contact-form')
@Controller('contact-form')
export class ContactFormController {
  constructor(private readonly contactFormService: ContactFormService) {}

  @Post('/process-event')
  @ApiOperation({
    summary: 'Process contact form event',
    description: 'Processes a contact form submission event from the event store',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
            occurredOn: { type: 'string', format: 'date-time' },
            attributes: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                phone: { type: 'string' },
                company: { type: 'string' },
                message: { type: 'string' },
                source: { type: 'string' },
                page: { type: 'string' },
              },
            },
          },
        },
        metadata: {
          type: 'object',
          properties: {
            origin: { type: 'string' },
            userAgent: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Event processed successfully',
    type: ContactFormSubmission,
  })
  @ApiResponse({ status: 400, description: 'Invalid event data' })
  public async processEvent(
    @Body() eventData: ContactFormEventData
  ): Promise<ContactFormSubmission> {
    return this.contactFormService.processContactFormEvent(eventData);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({
    summary: 'Get all contact form submissions',
    description: 'Retrieves all contact form submissions with pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of results',
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of results to skip',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'Submissions retrieved successfully',
    type: [ContactFormSubmission],
  })
  public async getSubmissions(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ): Promise<ContactFormSubmission[]> {
    const limitNum = limit ? parseInt(limit.toString(), 10) : 50;
    const offsetNum = offset ? parseInt(offset.toString(), 10) : 0;
    return this.contactFormService.getSubmissions(limitNum, offsetNum);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/count')
  @ApiOperation({
    summary: 'Get total count of submissions',
    description: 'Returns the total number of contact form submissions',
  })
  @ApiResponse({
    status: 200,
    description: 'Count retrieved successfully',
    schema: { type: 'object', properties: { count: { type: 'number' } } },
  })
  public async getTotalCount(): Promise<{ count: number }> {
    const count = await this.contactFormService.getTotalCount();
    return { count };
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get submission by ID',
    description: 'Retrieves a contact form submission by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Submission ID', example: 'submission-123' })
  @ApiResponse({ status: 200, description: 'Submission found', type: ContactFormSubmission })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  public async getSubmissionById(@Param('id') id: string): Promise<ContactFormSubmission> {
    return this.contactFormService.getSubmissionById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/source/:source')
  @ApiOperation({
    summary: 'Get submissions by source',
    description: 'Retrieves contact form submissions filtered by source type',
  })
  @ApiParam({ name: 'source', description: 'Source type', example: 'contact-form' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of results',
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of results to skip',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'Submissions retrieved successfully',
    type: [ContactFormSubmission],
  })
  public async getSubmissionsBySource(
    @Param('source') source: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ): Promise<ContactFormSubmission[]> {
    const limitNum = limit ? parseInt(limit.toString(), 10) : 50;
    const offsetNum = offset ? parseInt(offset.toString(), 10) : 0;
    return this.contactFormService.getSubmissionsBySource(source, limitNum, offsetNum);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/email/:email')
  @ApiOperation({
    summary: 'Get submissions by email',
    description: 'Retrieves all contact form submissions for a specific email address',
  })
  @ApiParam({ name: 'email', description: 'Email address', example: 'user@example.com' })
  @ApiResponse({
    status: 200,
    description: 'Submissions retrieved successfully',
    type: [ContactFormSubmission],
  })
  public async getSubmissionsByEmail(
    @Param('email') email: string
  ): Promise<ContactFormSubmission[]> {
    return this.contactFormService.getSubmissionsByEmail(email);
  }
}
