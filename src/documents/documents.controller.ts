import {
  Body, Controller, Get, Param, Patch, Post, Res, UploadedFiles, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { Readable } from 'stream';
import { ObjectList } from 'aws-sdk/clients/s3';
import { DocumentsService } from './documents.service';
import { GetDocumentsParamsDto } from './dto/get-documents.params.dto';
import { UploadDocumentsInputsDto } from './dto/upload-documents.inputs.dto';
import { AuthGuard } from '../auth/auth.guard';
import { Document, DocumentOption } from './model/document.entity';
import { User } from '../auth/user.decorator';
import { AnyFilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService
  ) {}

  @UseGuards(AuthGuard)
  @Get('/options/all')
  public async getDocumentOptions(): Promise<DocumentOption[]> {
      return this.documentsService.getDocumentOptions();
  }

  @UseGuards(AuthGuard)
  @Get('/commerceId/:commerceId')
  public async getDocumentsByCommerceId(@Param() params: any): Promise<Document[]> {
      const { commerceId } = params;
      return this.documentsService.getDocumentsByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @Get('/commerceId/:commerceId/option/:option')
  public async getDocumentsByOption(@Param() params: any): Promise<Document> {
      const { commerceId, option } = params;
      return this.documentsService.getDocumentsByOption(commerceId, option);
  }

  @UseGuards(AuthGuard)
  @UseInterceptors(AnyFilesInterceptor())
  @Post()
  public uploadDocument(@User() user, @UploadedFiles() files, @Body() body: UploadDocumentsInputsDto): Promise<any> {
    const {
      commerceId, name, format,
    } = body;
    return this.documentsService.uploadDocument(user, commerceId, name, commerceId, format, files);
  }

  @UseGuards(AuthGuard)
  @Get(':documentKey/:reportType')
  public getDocument(@Param() params: GetDocumentsParamsDto, @Res() response): Readable {
    const { documentKey, reportType } = params;
    const readable = this.documentsService.getDocument(documentKey, reportType);
    return readable.pipe(response);
  }

  @UseGuards(AuthGuard)
  @Get('list/:reportType/:documentKey')
  public getDocumentList(@Param() params: GetDocumentsParamsDto): Promise<ObjectList> {
    const { reportType, documentKey } = params;
    return this.documentsService.getDocumentsList(reportType, documentKey);
  }

  @UseGuards(AuthGuard)
  @Patch('/:id')
  public async updateDocument(@User() user, @Param() params: any, @Body() body: Document): Promise<Document> {
    const { id } = params;
    const { active } = body;
    return this.documentsService.updateDocument(user, id, active);
  }
}
