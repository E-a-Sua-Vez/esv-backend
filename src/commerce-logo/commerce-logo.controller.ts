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
import { CommerceLogoService } from './commerce-logo.service';
import { CommerceLogo, CommerceLogoUploadDto } from './model/commerce-logo.entity';

@ApiTags('commerce-logos')
@Controller('commerce-logos')
export class CommerceLogoController {
  constructor(private readonly commerceLogoService: CommerceLogoService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('logo'))
  @Post(':commerceId')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload commerce logo',
    description: 'Uploads a new logo for a commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        logo: {
          type: 'string',
          format: 'binary',
          description: 'Commerce logo file (JPG, PNG, WebP, max 5MB)',
        },
        businessId: {
          type: 'string',
          example: 'business-123',
          description: 'Business ID that owns this commerce',
        },
        logoType: {
          type: 'string',
          example: 'commerce_logo',
          description: 'Type of logo',
        },
        uploadDate: {
          type: 'string',
          format: 'date-time',
          description: 'Upload date',
        },
      },
      required: ['logo', 'businessId'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Logo uploaded successfully',
    type: CommerceLogo,
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadCommerceLogo(
    @User() user: any,
    @Param('commerceId') commerceId: string,
    @UploadedFile() file: any,
    @Body() body: CommerceLogoUploadDto
  ): Promise<CommerceLogo> {
    const metadata = {
      uploadDate: body.uploadDate,
    };

    return this.commerceLogoService.uploadCommerceLogo(
      user.id || user.email,
      commerceId,
      body.businessId,
      file,
      metadata
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get(':commerceId')
  @ApiOperation({
    summary: 'Get commerce logo URL',
    description: 'Retrieves commerce logo URL for access through backend',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({
    status: 200,
    description: 'Commerce logo signed URL',
    type: String,
  })
  @ApiResponse({ status: 404, description: 'Logo not found' })
  async getCommerceLogo(
    @Param('commerceId') commerceId: string
  ): Promise<string | null> {
    return await this.commerceLogoService.getCommerceLogoSignedUrl(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get(':commerceId/:logoId')
  @ApiOperation({
    summary: 'Get commerce logo file',
    description: 'Retrieves and streams the commerce logo file',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'logoId', description: 'Logo ID', example: 'logo-123' })
  @ApiResponse({ status: 200, description: 'Commerce logo file stream' })
  @ApiResponse({ status: 404, description: 'Logo not found' })
  async getCommerceLogoFile(
    @Param('commerceId') commerceId: string,
    @Param('logoId') logoId: string,
    @Res() response: any
  ): Promise<Readable> {
    const readable = await this.commerceLogoService.getCommerceLogoStream(
      commerceId,
      logoId
    );
    response.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    });
    return readable.pipe(response);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get(':commerceId/:logoId/thumbnail')
  @ApiOperation({
    summary: 'Get commerce logo thumbnail',
    description: 'Retrieves and streams the commerce logo thumbnail',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'logoId', description: 'Logo ID', example: 'logo-123' })
  @ApiResponse({ status: 200, description: 'Commerce logo thumbnail stream' })
  @ApiResponse({ status: 404, description: 'Thumbnail not found' })
  async getCommerceLogoThumbnail(
    @Param('commerceId') commerceId: string,
    @Param('logoId') logoId: string,
    @Res() response: any
  ): Promise<Readable> {
    const readable = await this.commerceLogoService.getCommerceLogoThumbnailStream(
      commerceId,
      logoId
    );
    response.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    });
    return readable.pipe(response);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('logo'))
  @Put(':commerceId')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update commerce logo',
    description: 'Replaces the existing commerce logo with a new one',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        logo: {
          type: 'string',
          format: 'binary',
          description: 'New commerce logo file (JPG, PNG, WebP, max 5MB)',
        },
        businessId: {
          type: 'string',
          example: 'business-123',
          description: 'Business ID that owns this commerce',
        },
        logoType: {
          type: 'string',
          example: 'commerce_logo',
          description: 'Type of logo',
        },
        uploadDate: {
          type: 'string',
          format: 'date-time',
          description: 'Upload date',
        },
      },
      required: ['logo', 'businessId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Logo updated successfully',
    type: CommerceLogo,
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid file' })
  @ApiResponse({ status: 404, description: 'Commerce not found' })
  async updateCommerceLogo(
    @User() user: any,
    @Param('commerceId') commerceId: string,
    @UploadedFile() file: any,
    @Body() body: CommerceLogoUploadDto
  ): Promise<CommerceLogo> {
    const metadata = {
      uploadDate: body.uploadDate,
    };

    return this.commerceLogoService.updateCommerceLogo(
      user.id || user.email,
      commerceId,
      body.businessId,
      file,
      metadata
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete(':commerceId/:logoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete commerce logo',
    description: 'Deletes a commerce logo and its thumbnail',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'logoId', description: 'Logo ID', example: 'logo-123' })
  @ApiResponse({ status: 204, description: 'Logo deleted successfully' })
  @ApiResponse({ status: 404, description: 'Logo not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized' })
  async deleteCommerceLogo(
    @User() user: any,
    @Param('commerceId') commerceId: string,
    @Param('logoId') logoId: string
  ): Promise<void> {
    return this.commerceLogoService.deleteCommerceLogo(
      user.id || user.email,
      commerceId,
      logoId
    );
  }
}
