import { Readable } from 'stream';

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { ObjectList } from 'aws-sdk/clients/s3';

import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/user.decorator';

import { DocumentsService } from './documents.service';
import { GetDocumentsParamsDto } from './dto/get-documents.params.dto';
import { UploadDocumentsInputsDto, DocumentSearchDto } from './dto/upload-documents.inputs.dto';
import { Document, DocumentOption } from './model/document.entity';
import { DocumentType } from './model/document.enum';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/options/all')
  @ApiOperation({
    summary: 'Get all document options',
    description: 'Retrieves all available document option types',
  })
  @ApiResponse({ status: 200, description: 'List of document options', type: [DocumentOption] })
  public async getDocumentOptions(): Promise<DocumentOption[]> {
    return this.documentsService.getDocumentOptions();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId')
  @ApiOperation({
    summary: 'Get documents by commerce ID',
    description: 'Retrieves all documents for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of documents', type: [Document] })
  public async getDocumentsByCommerceId(@Param() params: any): Promise<Document[]> {
    const { commerceId } = params;
    return this.documentsService.getDocumentsByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/client/:clientId')
  @ApiOperation({
    summary: 'Get client documents',
    description: 'Retrieves all documents for a specific client',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'clientId', description: 'Client ID', example: 'client-123' })
  @ApiResponse({ status: 200, description: 'List of client documents', type: [Document] })
  public async getDocumentsByCommerceIdAndClient(@Param() params: any): Promise<Document[]> {
    const { commerceId, clientId } = params;
    return this.documentsService.getDocumentsByCommerceIdAndClient(
      commerceId,
      clientId,
      DocumentType.CLIENT
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/option/:option')
  @ApiOperation({
    summary: 'Get document by option',
    description: 'Retrieves a specific document by commerce and option type',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'option', description: 'Document option type', example: 'TERMS' })
  @ApiResponse({ status: 200, description: 'Document found', type: Document })
  public async getDocumentsByOption(@Param() params: any): Promise<Document> {
    const { commerceId, option } = params;
    return this.documentsService.getDocumentsByOption(commerceId, option);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(AnyFilesInterceptor())
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload document', description: 'Uploads a new document file' })
  @ApiBody({ type: UploadDocumentsInputsDto })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public uploadDocument(
    @User() user,
    @UploadedFiles() files,
    @Body() body: UploadDocumentsInputsDto
  ): Promise<any> {
    const { commerceId, name, format, reportType } = body;
    return this.documentsService.uploadDocument(user, commerceId, reportType, name, format, files);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(AnyFilesInterceptor())
  @Post('/client')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload client document',
    description: 'Uploads a document file for a specific client with ecosystem integration',
  })
  @ApiBody({ type: UploadDocumentsInputsDto })
  @ApiResponse({ status: 201, description: 'Client document uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public uploadClientDocument(
    @User() user,
    @UploadedFiles() files,
    @Body() body: UploadDocumentsInputsDto
  ): Promise<any> {
    const {
      commerceId,
      clientId,
      name,
      format,
      reportType,
      documentMetadata,
      attentionId,
      patientHistoryId,
      collaboratorId,
      category,
      urgency,
      tags
    } = body;

    // Sanitize collaboratorId to ensure it's a string (form data can be tricky)
    let sanitizedCollaboratorId: string | undefined = undefined;
    if (collaboratorId !== undefined && collaboratorId !== null) {
      if (typeof collaboratorId === 'string') {
        sanitizedCollaboratorId = collaboratorId.trim();
      } else if (typeof collaboratorId === 'object' && collaboratorId !== null) {
        // Extract ID from object if it's an object
        sanitizedCollaboratorId = (collaboratorId as any).id || (collaboratorId as any).userId || String(collaboratorId);
      } else {
        sanitizedCollaboratorId = String(collaboratorId);
      }
    }

    return this.documentsService.uploadClientDocument(
      user,
      commerceId,
      clientId,
      reportType,
      name,
      format,
      files,
      documentMetadata,
      attentionId,
      patientHistoryId,
      sanitizedCollaboratorId, // Use sanitized version
      category,
      urgency,
      tags ? (Array.isArray(tags) ? tags : (tags as string).split(',')) : []
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get(':documentKey/:reportType')
  @ApiOperation({
    summary: 'Get document file',
    description: 'Retrieves and streams a document file',
  })
  @ApiParam({ name: 'documentKey', description: 'Document key', example: 'doc-key-123' })
  @ApiParam({ name: 'reportType', description: 'Report type', example: 'PDF' })
  @ApiResponse({ status: 200, description: 'Document file stream' })
  public getDocument(@Param() params: GetDocumentsParamsDto, @Res() response): Readable {
    const { documentKey, reportType } = params;
    const readable = this.documentsService.getDocument(documentKey, reportType);
    readable.on('error', (error: any) => {
      const status = error?.code === 'NoSuchKey' ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
      const message =
        error?.code === 'NoSuchKey' ? 'Documento no encontrado' : 'Error al obtener el documento';

      if (!response.headersSent) {
        response.status(status).send({ message });
      }
    });
    return readable.pipe(response);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('client/:documentKey/:reportType/:name')
  @ApiOperation({
    summary: 'Get client document file',
    description: 'Retrieves and streams a client document file',
  })
  @ApiParam({ name: 'documentKey', description: 'Document key', example: 'doc-key-123' })
  @ApiParam({ name: 'reportType', description: 'Report type', example: 'PDF' })
  @ApiParam({ name: 'name', description: 'Document name', example: 'document.pdf' })
  @ApiResponse({ status: 200, description: 'Client document file stream' })
  public getDocumentById(@Param() params: GetDocumentsParamsDto, @Res() response): Readable {
    const { documentKey, reportType, name } = params;
    const readable = this.documentsService.getClientDocument(documentKey, reportType, name);
    readable.on('error', (error: any) => {
      const status = error?.code === 'NoSuchKey' ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
      const message =
        error?.code === 'NoSuchKey' ? 'Documento no encontrado' : 'Error al obtener el documento';

      if (!response.headersSent) {
        response.status(status).send({ message });
      }
    });
    return readable.pipe(response);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('list/:reportType/:documentKey')
  @ApiOperation({
    summary: 'Get document list',
    description: 'Retrieves a list of documents from storage',
  })
  @ApiParam({ name: 'reportType', description: 'Report type', example: 'PDF' })
  @ApiParam({ name: 'documentKey', description: 'Document key prefix', example: 'doc-key' })
  @ApiResponse({ status: 200, description: 'List of documents', schema: { type: 'object' } })
  public getDocumentList(@Param() params: GetDocumentsParamsDto): Promise<ObjectList> {
    const { reportType, documentKey } = params;
    return this.documentsService.getDocumentsList(reportType, documentKey);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/active')
  @ApiOperation({
    summary: 'Activate/deactivate document',
    description: 'Updates the active status of a document',
  })
  @ApiParam({ name: 'id', description: 'Document ID', example: 'document-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        active: { type: 'boolean', example: true },
      },
      required: ['active'],
    },
  })
  @ApiResponse({ status: 200, description: 'Document status updated successfully', type: Document })
  public async activeDocument(
    @User() user,
    @Param() params: any,
    @Body() body: Document
  ): Promise<Document> {
    const { id } = params;
    const { active } = body;
    return this.documentsService.activeDocument(user, id, active);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/available')
  @ApiOperation({
    summary: 'Set document availability',
    description: 'Updates the availability status of a document',
  })
  @ApiParam({ name: 'id', description: 'Document ID', example: 'document-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        available: { type: 'boolean', example: true },
      },
      required: ['available'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Document availability updated successfully',
    type: Document,
  })
  public async availableDocument(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Document> {
    const { id } = params;
    const { available } = body;
    return this.documentsService.availableDocument(user, id, available);
  }

  // New Enhanced Endpoints for Ecosystem Integration

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/attention/:attentionId')
  @ApiOperation({
    summary: 'Get documents by attention',
    description: 'Retrieves all documents linked to a specific attention/consultation',
  })
  @ApiParam({ name: 'attentionId', description: 'Attention ID', example: 'attention-123' })
  @ApiResponse({ status: 200, description: 'List of attention documents', type: [Document] })
  public async getDocumentsByAttention(@Param('attentionId') attentionId: string): Promise<Document[]> {
    return this.documentsService.getDocumentsByAttention(attentionId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/patient-history/:patientHistoryId')
  @ApiOperation({
    summary: 'Get documents by patient history',
    description: 'Retrieves all documents linked to a specific patient history record',
  })
  @ApiParam({ name: 'patientHistoryId', description: 'Patient History ID', example: 'history-123' })
  @ApiResponse({ status: 200, description: 'List of patient history documents', type: [Document] })
  public async getDocumentsByPatientHistory(@Param('patientHistoryId') patientHistoryId: string): Promise<Document[]> {
    return this.documentsService.getDocumentsByPatientHistory(patientHistoryId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/search')
  @ApiOperation({
    summary: 'Advanced document search',
    description: 'Search documents with multiple filters and criteria',
  })
  @ApiBody({ type: DocumentSearchDto })
  @ApiResponse({ status: 200, description: 'Filtered list of documents', type: [Document] })
  public async searchDocuments(@Body() searchDto: DocumentSearchDto): Promise<Document[]> {
    const { commerceId, clientId, ...filters } = searchDto;
    return this.documentsService.getDocumentsByClientWithFilters(commerceId, clientId, filters);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/link-attention')
  @ApiOperation({
    summary: 'Link document to attention',
    description: 'Links an existing document to a specific attention/consultation',
  })
  @ApiParam({ name: 'id', description: 'Document ID', example: 'document-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        attentionId: { type: 'string', example: 'attention-123' },
      },
      required: ['attentionId'],
    },
  })
  @ApiResponse({ status: 200, description: 'Document linked successfully', type: Document })
  public async linkDocumentToAttention(
    @User() user,
    @Param('id') id: string,
    @Body() body: { attentionId: string }
  ): Promise<Document> {
    return this.documentsService.linkDocumentToAttention(id, body.attentionId, user);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id/tags')
  @ApiOperation({
    summary: 'Update document tags',
    description: 'Updates the tags associated with a document',
  })
  @ApiParam({ name: 'id', description: 'Document ID', example: 'document-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' }, example: ['urgent', 'cardiology'] },
      },
      required: ['tags'],
    },
  })
  @ApiResponse({ status: 200, description: 'Document tags updated successfully', type: Document })
  public async updateDocumentTags(
    @User() user,
    @Param('id') id: string,
    @Body() body: { tags: string[] }
  ): Promise<Document> {
    return this.documentsService.updateDocumentTags(id, body.tags, user);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/access-log')
  @ApiOperation({
    summary: 'Log document access',
    description: 'Records document access for audit trail',
  })
  @ApiParam({ name: 'id', description: 'Document ID', example: 'document-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        accessType: { type: 'string', example: 'view' },
        userType: { type: 'string', example: 'collaborator' },
        ipAddress: { type: 'string', example: '192.168.1.1' },
        userAgent: { type: 'string', example: 'Mozilla/5.0...' },
      },
      required: ['accessType', 'userType'],
    },
  })
  @ApiResponse({ status: 200, description: 'Access logged successfully' })
  public async logDocumentAccess(
    @User() user,
    @Param('id') id: string,
    @Body() body: { accessType: string; userType: string; ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    return this.documentsService.addDocumentAccess(
      id,
      user,
      body.userType,
      body.accessType,
      body.ipAddress,
      body.userAgent
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/track-download')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Track document download',
    description: 'Records document download for audit trail and CQRS events',
  })
  @ApiParam({ name: 'id', description: 'Document ID', example: 'document-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userType: { type: 'string', example: 'collaborator' },
        ipAddress: { type: 'string', example: '192.168.1.1' },
        userAgent: { type: 'string', example: 'Mozilla/5.0...' },
      },
      required: ['userType'],
    },
  })
  @ApiResponse({ status: 200, description: 'Download logged successfully' })
  public async trackDocumentDownload(
    @User() user,
    @Param('id') id: string,
    @Body() body: { userType: string; ipAddress?: string; userAgent?: string },
    @Req() req: any
  ): Promise<void> {
    const ipAddress = body.ipAddress || req.ip || req.connection?.remoteAddress;
    const userAgent = body.userAgent || req.headers['user-agent'];

    return this.documentsService.trackDocumentDownload(
      id,
      user,
      body.userType as 'collaborator' | 'client' | 'admin',
      ipAddress,
      userAgent
    );
  }
}
