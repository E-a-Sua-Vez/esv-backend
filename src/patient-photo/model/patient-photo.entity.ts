import { Collection } from 'fireorm';

@Collection('patient-photos')
export class PatientPhoto {
  id: string;
  commerceId: string;
  clientId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  s3Key: string;
  thumbnailS3Key?: string;
  uploadDate: Date;
  createdBy: string;
  createdAt: Date;
  modifiedBy?: string;
  modifiedAt?: Date;
  active: boolean;
  metadata?: {
    width?: number;
    height?: number;
    capturedFrom?: 'camera' | 'upload';
    deviceInfo?: string;
  };
}

export class PatientPhotoUploadDto {
  commerceId: string;
  clientId: string;
  photoType: string;
  uploadDate: string;
}












