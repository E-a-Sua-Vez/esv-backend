import { Collection } from 'fireorm';

@Collection('commerce-logos')
export class CommerceLogo {
  id: string;
  commerceId: string;
  businessId: string;
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
    aspectRatio?: number;
  };
}

export class CommerceLogoUploadDto {
  commerceId: string;
  businessId: string;
  logoType: string;
  uploadDate: string;
}
