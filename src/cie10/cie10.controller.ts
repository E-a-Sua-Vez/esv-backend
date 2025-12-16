import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

import { CIE10Service, CIE10Code } from './cie10.service';

@ApiTags('cie10')
@Controller('cie10')
export class CIE10Controller {
  constructor(private readonly cie10Service: CIE10Service) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/search')
  @ApiOperation({
    summary: 'Search CIE-10 codes',
    description: 'Search for CIE-10 codes by code or description',
  })
  @ApiQuery({ name: 'q', description: 'Search term', required: false })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of results',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'List of CIE-10 codes',
    type: [Object],
  })
  async searchCodes(
    @Query('q') searchTerm?: string,
    @Query('limit') limit?: number
  ): Promise<CIE10Code[]> {
    const limitNum = limit ? parseInt(limit.toString(), 10) : 50;
    return this.cie10Service.searchCodes(searchTerm || '', limitNum);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/code/:code')
  @ApiOperation({
    summary: 'Get CIE-10 code by code',
    description: 'Retrieves a CIE-10 code by its exact code',
  })
  @ApiParam({ name: 'code', description: 'CIE-10 code', example: 'E11' })
  @ApiResponse({
    status: 200,
    description: 'CIE-10 code found',
  })
  @ApiResponse({ status: 404, description: 'CIE-10 code not found' })
  async getCodeByCode(@Param('code') code: string): Promise<CIE10Code | null> {
    return this.cie10Service.getCodeByCode(code);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/validate/:code')
  @ApiOperation({
    summary: 'Validate CIE-10 code',
    description: 'Validates if a CIE-10 code exists',
  })
  @ApiParam({ name: 'code', description: 'CIE-10 code to validate', example: 'E11' })
  @ApiResponse({
    status: 200,
    description: 'Validation result',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        code: { type: 'string' },
      },
    },
  })
  async validateCode(@Param('code') code: string): Promise<{ valid: boolean; code?: CIE10Code }> {
    const cie10Code = this.cie10Service.getCodeByCode(code);
    return {
      valid: !!cie10Code,
      code: cie10Code || undefined,
    };
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({
    summary: 'Get all CIE-10 codes (paginated)',
    description: 'Retrieves all CIE-10 codes with pagination',
  })
  @ApiQuery({ name: 'page', description: 'Page number', required: false, type: Number })
  @ApiQuery({ name: 'limit', description: 'Items per page', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of CIE-10 codes',
  })
  async getAllCodes(@Query('page') page?: number, @Query('limit') limit?: number) {
    const pageNum = page ? parseInt(page.toString(), 10) : 1;
    const limitNum = limit ? parseInt(limit.toString(), 10) : 50;
    return this.cie10Service.getAllCodes(pageNum, limitNum);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/chapter/:chapter')
  @ApiOperation({
    summary: 'Get CIE-10 codes by chapter',
    description: 'Retrieves all CIE-10 codes for a specific chapter',
  })
  @ApiParam({ name: 'chapter', description: 'Chapter number (Roman numeral)', example: 'IX' })
  @ApiResponse({
    status: 200,
    description: 'List of CIE-10 codes for the chapter',
  })
  async getCodesByChapter(@Param('chapter') chapter: string): Promise<CIE10Code[]> {
    return this.cie10Service.getCodesByChapter(chapter);
  }
}
