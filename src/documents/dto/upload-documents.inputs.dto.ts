import { DocumentMetadata } from '../model/document.entity';
export class UploadDocumentsInputsDto {
  commerceId: string;
  clientId: string;
  documentMetadata: DocumentMetadata;
  details: object;
  name: string;
  reportType: string;
  format: string;
  file: File;
}
