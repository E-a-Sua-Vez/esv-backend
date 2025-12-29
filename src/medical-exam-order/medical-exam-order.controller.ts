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
  Res,
  HttpException,
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
import { Response } from 'express';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

import { CreateExamOrderDto } from './dto/create-exam-order.dto';
import { CreateMedicalExamDto } from './dto/create-medical-exam.dto';
import { MedicalExamOrderPdfService } from './medical-exam-order-pdf.service';
import { MedicalExamOrderService } from './medical-exam-order.service';
import { GeneratedDocumentService } from '../shared/services/generated-document.service';
import { ExamOrderStatus, ExamType } from './model/exam-order-status.enum';
import { MedicalExamOrder, ExamResult } from './model/medical-exam-order.entity';
import { MedicalExam } from './model/medical-exam.entity';

@ApiTags('medical-exam-order')
@Controller('medical-exam-order')
export class MedicalExamOrderController {
  constructor(
    private readonly examOrderService: MedicalExamOrderService,
    private readonly examOrderPdfService: MedicalExamOrderPdfService,
    private readonly generatedDocumentService: GeneratedDocumentService
  ) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/exams')
  @ApiOperation({
    summary: 'Get all medical exams',
    description: 'Retrieves all active medical exams from the catalog',
  })
  @ApiResponse({
    status: 200,
    description: 'List of exams',
    type: [MedicalExam],
  })
  async getAllExams() {
    return this.examOrderService.getAllExams();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/exams/commerce/:commerceId')
  @ApiOperation({
    summary: 'Get medical exams by commerce',
    description: 'Retrieves all active medical exams for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID' })
  @ApiResponse({
    status: 200,
    description: 'List of exams',
    type: [MedicalExam],
  })
  async getExamsByCommerce(@Param('commerceId') commerceId: string) {
    return this.examOrderService.getExamsByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/exams/search')
  @ApiOperation({
    summary: 'Search medical exams',
    description: 'Search for medical exams in the catalog',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Search term' })
  @ApiQuery({ name: 'type', required: false, enum: ExamType })
  @ApiQuery({ name: 'commerceId', required: false, description: 'Commerce ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of exams',
  })
  async searchExams(
    @Query('q') searchTerm?: string,
    @Query('type') type?: ExamType,
    @Query('commerceId') commerceId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    const pageNum = page ? parseInt(page.toString(), 10) : 1;
    const limitNum = limit ? parseInt(limit.toString(), 10) : 50;
    return this.examOrderService.searchExams(searchTerm, type, commerceId, pageNum, limitNum);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/exams/:id')
  @ApiOperation({
    summary: 'Get exam by ID',
    description: 'Retrieves a medical exam from the catalog by ID',
  })
  @ApiParam({ name: 'id', description: 'Exam ID' })
  @ApiResponse({
    status: 200,
    description: 'Exam found',
    type: MedicalExam,
  })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  async getExamById(@Param('id') id: string) {
    return this.examOrderService.getExamById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/exams')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create medical exam',
    description: 'Creates a new medical exam in the catalog',
  })
  @ApiBody({ type: CreateMedicalExamDto })
  @ApiResponse({
    status: 201,
    description: 'Exam created successfully',
    type: MedicalExam,
  })
  async createMedicalExam(@User() user, @Body() createDto: CreateMedicalExamDto) {
    return this.examOrderService.createMedicalExam(user.id || user, createDto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/exams/:id')
  @ApiOperation({
    summary: 'Update medical exam',
    description: 'Updates a medical exam in the catalog',
  })
  @ApiParam({ name: 'id', description: 'Exam ID' })
  @ApiBody({ type: CreateMedicalExamDto })
  @ApiResponse({
    status: 200,
    description: 'Exam updated successfully',
    type: MedicalExam,
  })
  async updateMedicalExam(@User() user, @Param('id') id: string, @Body() updateDto: CreateMedicalExamDto) {
    const userId = typeof user === 'object' && user?.id ? user.id : typeof user === 'string' ? user : 'system';
    return this.examOrderService.updateMedicalExam(id, updateDto, userId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete('/exams/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete medical exam',
    description: 'Soft deletes a medical exam from the catalog',
  })
  @ApiParam({ name: 'id', description: 'Exam ID' })
  @ApiResponse({
    status: 204,
    description: 'Exam deleted successfully',
  })
  async deleteMedicalExam(@User() user, @Param('id') id: string) {
    const userId = typeof user === 'object' && user?.id ? user.id : typeof user === 'string' ? user : 'system';
    await this.examOrderService.deleteMedicalExam(id, userId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create exam order',
    description: 'Creates a new medical exam order',
  })
  @ApiBody({ type: CreateExamOrderDto })
  @ApiResponse({
    status: 201,
    description: 'Exam order created successfully',
    type: MedicalExamOrder,
  })
  async createExamOrder(
    @User() user,
    @Body() createDto: CreateExamOrderDto
  ): Promise<MedicalExamOrder> {
    return this.examOrderService.createExamOrder(user, createDto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get exam order by ID',
    description: 'Retrieves an exam order by its ID',
  })
  @ApiParam({ name: 'id', description: 'Exam order ID' })
  @ApiResponse({
    status: 200,
    description: 'Exam order found',
    type: MedicalExamOrder,
  })
  async getExamOrderById(@Param('id') id: string): Promise<MedicalExamOrder> {
    return this.examOrderService.getExamOrderById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/client/:commerceId/:clientId')
  @ApiOperation({
    summary: 'Get exam orders by client',
    description: 'Retrieves all exam orders for a specific client',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID' })
  @ApiParam({ name: 'clientId', description: 'Client ID' })
  @ApiResponse({
    status: 200,
    description: 'List of exam orders',
    type: [MedicalExamOrder],
  })
  async getExamOrdersByClient(
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string
  ): Promise<MedicalExamOrder[]> {
    return this.examOrderService.getExamOrdersByClient(commerceId, clientId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/status')
  @ApiOperation({
    summary: 'Update exam order status',
    description: 'Updates the status of an exam order',
  })
  @ApiParam({ name: 'id', description: 'Exam order ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: Object.values(ExamOrderStatus) },
        scheduledDate: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Status updated successfully',
    type: MedicalExamOrder,
  })
  async updateOrderStatus(
    @User() user,
    @Param('id') id: string,
    @Body() body: { status: ExamOrderStatus; scheduledDate?: string }
  ): Promise<MedicalExamOrder> {
    const scheduledDate = body.scheduledDate ? new Date(body.scheduledDate) : undefined;
    return this.examOrderService.updateOrderStatus(user, id, body.status, scheduledDate);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/results')
  @ApiOperation({
    summary: 'Add exam results',
    description: 'Adds results to an exam order',
  })
  @ApiParam({ name: 'id', description: 'Exam order ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: { type: 'object' },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Results added successfully',
    type: MedicalExamOrder,
  })
  async addExamResults(
    @User() user,
    @Param('id') id: string,
    @Body() body: { results: ExamResult[] }
  ): Promise<MedicalExamOrder> {
    return this.examOrderService.addExamResults(user, id, body.results);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id/pdf')
  @ApiOperation({
    summary: 'Download exam order PDF',
    description: 'Downloads the PDF file for an exam order',
  })
  @ApiParam({ name: 'id', description: 'Exam order ID' })
  @ApiResponse({
    status: 200,
    description: 'PDF file',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'PDF not found' })
  async downloadExamOrderPdf(@Param('id') id: string, @Res() res: Response): Promise<void> {
    try {
      const examOrder = await this.examOrderService.getExamOrderById(id);
      const pdfStream = await this.examOrderPdfService.getExamOrderPdf(
        examOrder.id,
        examOrder.commerceId
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="exam-order-${examOrder.id}.pdf"`);

      pdfStream.pipe(res);
    } catch (error) {
      // Si el PDF no existe (404), intentar generarlo
      if (error.status === HttpStatus.NOT_FOUND || error.statusCode === HttpStatus.NOT_FOUND) {
        // Generar el PDF mediante el servicio (que lo genera de forma asíncrona)
        // Por ahora, retornar un error indicando que se está generando
        // En una próxima implementación, podríamos generar síncronamente aquí
        throw new HttpException(
          'PDF is being generated. Please try again in a few moments.',
          HttpStatus.NOT_FOUND
        );
      } else {
        throw error;
      }
    }
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id/pdf-url')
  @ApiOperation({
    summary: 'Get exam order PDF URL',
    description: 'Gets a signed URL to download the exam order PDF',
  })
  @ApiParam({ name: 'id', description: 'Exam order ID' })
  @ApiQuery({
    name: 'expiresIn',
    required: false,
    description: 'URL expiration in seconds (default: 3600)',
  })
  @ApiResponse({
    status: 200,
    description: 'Signed URL for PDF download',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        expiresIn: { type: 'number' },
      },
    },
  })
  async getExamOrderPdfUrl(
    @Param('id') id: string,
    @Query('expiresIn') expiresIn?: number
  ): Promise<{ url: string; expiresIn: number }> {
    const examOrder = await this.examOrderService.getExamOrderById(id);
    const expires = expiresIn ? parseInt(expiresIn.toString(), 10) : 3600;
    const url = await this.examOrderPdfService.getExamOrderPdfUrl(
      examOrder.id,
      examOrder.commerceId,
      expires
    );

    return { url, expiresIn: expires };
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/send-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send exam order PDF by email',
    description: 'Sends the exam order PDF to the specified email address',
  })
  @ApiParam({ name: 'id', description: 'Exam Order ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        recipientEmail: { type: 'string', format: 'email' },
        subject: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['recipientEmail'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Email sent successfully',
  })
  @ApiResponse({ status: 404, description: 'Exam Order not found' })
  async sendExamOrderByEmail(
    @User() user,
    @Param('id') id: string,
    @Body() body: { recipientEmail: string; subject?: string; message?: string }
  ): Promise<{ success: boolean; message: string }> {
    const examOrder = await this.examOrderService.getExamOrderById(id);

    // Buscar documento por examOrderId en metadata o por attentionId y option
    const allDocuments = await this.generatedDocumentService['documentsService'].getDocumentsByClientWithFilters(
      examOrder.commerceId,
      examOrder.clientId,
      {
        attentionId: examOrder.attentionId,
      }
    );

    // Buscar documento de orden de examen
    const examOrderDocument = allDocuments.find(
      doc => doc.option === 'exam_order_pdf' &&
      (doc.attentionId === examOrder.attentionId ||
       (doc.documentMetadata as any)?.examOrderId === id)
    );

    if (!examOrderDocument) {
      throw new HttpException('Document not found for this exam order', HttpStatus.NOT_FOUND);
    }

    await this.generatedDocumentService.sendDocumentByEmail(
      user.id || user,
      examOrder.commerceId,
      examOrder.clientId,
      examOrder.attentionId,
      examOrderDocument.id,
      body.recipientEmail,
      body.subject,
      body.message
    );

    return {
      success: true,
      message: 'Exam order sent by email successfully',
    };
  }
}
