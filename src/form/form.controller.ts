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

import { FormService } from './form.service';
import { Form } from './model/form.entity';

@ApiTags('form')
@Controller('form')
export class FormController {
  constructor(private readonly formService: FormService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get form by ID',
    description: 'Retrieves a form by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Form ID', example: 'form-123' })
  @ApiResponse({ status: 200, description: 'Form found', type: Form })
  @ApiResponse({ status: 404, description: 'Form not found' })
  public async getFormById(@Param() params: any): Promise<Form> {
    const { id } = params;
    return this.formService.getFormById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({ summary: 'Get all forms', description: 'Retrieves a list of all forms' })
  @ApiResponse({ status: 200, description: 'List of forms', type: [Form] })
  public async getForms(): Promise<Form[]> {
    return this.formService.getForms();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/clientId/:clientId')
  @ApiOperation({
    summary: 'Get forms by client',
    description: 'Retrieves all forms for a specific client',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'clientId', description: 'Client ID', example: 'client-123' })
  @ApiResponse({ status: 200, description: 'List of forms', type: [Form] })
  public async getFormsByClient(@Param() params: any): Promise<Form[]> {
    const { commerceId, clientId } = params;
    return this.formService.getFormsByClient(commerceId, clientId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/clientId/:clientId/type/:type')
  @ApiOperation({
    summary: 'Get forms by client and type',
    description: 'Retrieves forms for a client filtered by type',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'clientId', description: 'Client ID', example: 'client-123' })
  @ApiParam({ name: 'type', description: 'Form type', example: 'MEDICAL' })
  @ApiResponse({ status: 200, description: 'List of forms', type: [Form] })
  public async getFormsByClientAndType(@Param() params: any): Promise<Form[]> {
    const { commerceId, clientId, type } = params;
    return this.formService.getFormsByClientAndType(commerceId, clientId, type);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new form', description: 'Creates a new form response' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        attentionId: { type: 'string', example: 'attention-123' },
        personalizedId: { type: 'string' },
        type: { type: 'string', example: 'MEDICAL' },
        bookingId: { type: 'string' },
        commerceId: { type: 'string', example: 'commerce-123' },
        queueId: { type: 'string' },
        clientId: { type: 'string', example: 'client-123' },
        questions: { type: 'array' },
        answers: { type: 'array' },
      },
      required: ['commerceId', 'clientId', 'type'],
    },
  })
  @ApiResponse({ status: 201, description: 'Form created successfully', type: Form })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createForm(@User() user, @Body() body: any): Promise<Form> {
    const {
      attentionId,
      personalizedId,
      type,
      bookingId,
      commerceId,
      queueId,
      clientId,
      questions,
      answers,
    } = body;
    return this.formService.createForm(
      user,
      personalizedId,
      type,
      bookingId,
      attentionId,
      commerceId,
      queueId,
      clientId,
      questions,
      answers
    );
  }
}
