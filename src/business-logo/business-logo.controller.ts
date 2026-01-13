import { Readable } from 'stream';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';

import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/user.decorator';
import { BusinessLogoService } from './business-logo.service';
import { BusinessLogo, BusinessLogoUploadDto } from './model/business-logo.entity';

@ApiTags('business-logos')
@Controller('business-logos')
export class BusinessLogoController {
  constructor(private readonly businessLogoService: BusinessLogoService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('logo'))
  @Post(':businessId')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload business logo',
    description: 'Uploads a new logo for a business',
  })
  @ApiParam({ name: 'businessId', description: 'Business ID', example: 'business-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        logo: {
          type: 'string',
          format: 'binary',
          description: 'Business logo file (JPG, PNG, WebP, max 5MB)',
        },
        logoType: {
          type: 'string',
          example: 'business_logo',
          description: 'Type of logo',
        },
        uploadDate: {
          type: 'string',
          format: 'date-time',
          description: 'Upload date',
        },
      },
      required: ['logo'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Logo uploaded successfully',
    type: BusinessLogo,
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadBusinessLogo(
    @User() user: any,
    @Param('businessId') businessId: string,
    @UploadedFile() file: any,
    @Body() body: BusinessLogoUploadDto
  ): Promise<BusinessLogo> {
    const metadata = {
      uploadDate: body.uploadDate,
    };

    return this.businessLogoService.uploadBusinessLogo(
      user.id || user.email,
      businessId,
      file,
      metadata
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get(':businessId')
  @ApiOperation({
    summary: 'Get business logo URL',
    description: 'Retrieves business logo URL for access through backend',
  })
  @ApiParam({ name: 'businessId', description: 'Business ID', example: 'yWwwFl5BaDmHU69mvshG' })
  @ApiResponse({
    status: 200,
    description: 'Business logo signed URL',
    type: String,
  })
  @ApiResponse({ status: 404, description: 'Logo not found' })
  async getBusinessLogo(
    @Param('businessId') businessId: string
  ): Promise<string | null> {
    return await this.businessLogoService.getBusinessLogoSignedUrl(businessId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get(':businessId/:logoId')
  @ApiOperation({
    summary: 'Get business logo file',
    description: 'Retrieves and streams the business logo file',
  })
  @ApiParam({ name: 'businessId', description: 'Business ID', example: 'business-123' })
  @ApiParam({ name: 'logoId', description: 'Logo ID', example: 'logo-123' })
  @ApiResponse({ status: 200, description: 'Business logo file stream' })
  @ApiResponse({ status: 404, description: 'Logo not found' })
  async getBusinessLogoFile(
    @Param('businessId') businessId: string,
    @Param('logoId') logoId: string,
    @Res() response: any
  ): Promise<Readable> {
    const readable = await this.businessLogoService.getBusinessLogoStream(
      businessId,
      logoId
    );
    readable.on('error', (error: any) => {
      const status = error?.code === 'NoSuchKey' ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
      const message =
        error?.code === 'NoSuchKey' ? 'Logo no encontrado' : 'Error al obtener el logo';

      if (!response.headersSent) {
        response.status(status).send({ message });
      }
    });
    response.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    });
    return readable.pipe(response);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get(':businessId/:logoId/thumbnail')
  @ApiOperation({
    summary: 'Get business logo thumbnail',
    description: 'Retrieves and streams the business logo thumbnail',
  })
  @ApiParam({ name: 'businessId', description: 'Business ID', example: 'business-123' })
  @ApiParam({ name: 'logoId', description: 'Logo ID', example: 'logo-123' })
  @ApiResponse({ status: 200, description: 'Business logo thumbnail stream' })
  @ApiResponse({ status: 404, description: 'Thumbnail not found' })
  async getBusinessLogoThumbnail(
    @Param('businessId') businessId: string,
    @Param('logoId') logoId: string,
    @Res() response: any
  ): Promise<Readable> {
    const readable = await this.businessLogoService.getBusinessLogoThumbnailStream(
      businessId,
      logoId
    );
    readable.on('error', (error: any) => {
      const status = error?.code === 'NoSuchKey' ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
      const message =
        error?.code === 'NoSuchKey' ? 'Miniatura de logo no encontrada' : 'Error al obtener la miniatura de logo';

      if (!response.headersSent) {
        response.status(status).send({ message });
      }
    });
    response.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    });
    return readable.pipe(response);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('logo'))
  @Put(':businessId')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update business logo',
    description: 'Replaces the existing business logo with a new one',
  })
  @ApiParam({ name: 'businessId', description: 'Business ID', example: 'business-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        logo: {
          type: 'string',
          format: 'binary',
          description: 'New business logo file (JPG, PNG, WebP, max 5MB)',
        },
        logoType: {
          type: 'string',
          example: 'business_logo',
          description: 'Type of logo',
        },
        uploadDate: {
          type: 'string',
          format: 'date-time',
          description: 'Upload date',
        },
      },
      required: ['logo'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Logo updated successfully',
    type: BusinessLogo,
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid file' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async updateBusinessLogo(
    @User() user: any,
    @Param('businessId') businessId: string,
    @UploadedFile() file: any,
    @Body() body: BusinessLogoUploadDto
  ): Promise<BusinessLogo> {
    const metadata = {
      uploadDate: body.uploadDate,
    };

    return this.businessLogoService.updateBusinessLogo(
      user.id || user.email,
      businessId,
      file,
      metadata
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete(':businessId/:logoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete business logo',
    description: 'Deletes a business logo and its thumbnail',
  })
  @ApiParam({ name: 'businessId', description: 'Business ID', example: 'business-123' })
  @ApiParam({ name: 'logoId', description: 'Logo ID', example: 'logo-123' })
  @ApiResponse({ status: 204, description: 'Logo deleted successfully' })
  @ApiResponse({ status: 404, description: 'Logo not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized' })
  async deleteBusinessLogo(
    @User() user: any,
    @Param('businessId') businessId: string,
    @Param('logoId') logoId: string
  ): Promise<void> {
    return this.businessLogoService.deleteBusinessLogo(
      user.id || user.email,
      businessId,
      logoId
    );
  }
}













