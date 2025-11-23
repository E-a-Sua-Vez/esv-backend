import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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

import { CompanyService } from './company.service';
import { Company } from './model/company.entity';

@ApiTags('company')
@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get company by ID',
    description: 'Retrieves a company by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Company ID', example: 'company-123' })
  @ApiResponse({ status: 200, description: 'Company found', type: Company })
  @ApiResponse({ status: 404, description: 'Company not found' })
  public async getCompanyById(@Param() params: any): Promise<Company> {
    const { id } = params;
    return this.companyService.getCompanyById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({ summary: 'Get all companies', description: 'Retrieves a list of all companies' })
  @ApiResponse({ status: 200, description: 'List of companies', type: [Company] })
  public async getCompanies(): Promise<Company[]> {
    return this.companyService.getCompanies();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerce/:commerceId')
  @ApiOperation({
    summary: 'Get companies by commerce',
    description: 'Retrieves all companies for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of companies', type: [Company] })
  public async getCompanyByCommerce(@Param() params: any): Promise<Company[]> {
    const { commerceId } = params;
    return this.companyService.getCompanyByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/active')
  @ApiOperation({
    summary: 'Get active companies by commerce',
    description: 'Retrieves all active companies for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of active companies', type: [Company] })
  public async getActiveCompaniesByCommerceId(@Param() params: any): Promise<Company[]> {
    const { commerceId } = params;
    return this.companyService.getActiveCompaniesByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/type/:type')
  @ApiOperation({
    summary: 'Get active companies by commerce and type',
    description: 'Retrieves active companies filtered by commerce and type',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'type', description: 'Company type', example: 'SUPPLIER' })
  @ApiResponse({ status: 200, description: 'List of active companies', type: [Company] })
  public async getActiveCompaniesByCommerceIdAndType(@Param() params: any): Promise<Company[]> {
    const { commerceId, type } = params;
    return this.companyService.getActiveCompaniesByCommerceAndType(commerceId, type);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/list/:ids')
  @ApiOperation({
    summary: 'Get companies by IDs',
    description: 'Retrieves multiple companies by their IDs (comma-separated)',
  })
  @ApiParam({
    name: 'ids',
    description: 'Comma-separated company IDs',
    example: 'company-1,company-2,company-3',
  })
  @ApiResponse({ status: 200, description: 'List of companies', type: [Company] })
  public async getCompaniesById(@Param() params: any): Promise<Company[]> {
    const { ids } = params;
    return this.companyService.getCompaniesById(ids.split(','));
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new company', description: 'Creates a new company record' })
  @ApiBody({ type: Company })
  @ApiResponse({ status: 201, description: 'Company created successfully', type: Company })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createCompany(@User() user, @Body() body: Company): Promise<Company> {
    const { commerceId, name, type, tag, online, order, companyInfo } = body;
    return this.companyService.createCompany(
      user,
      commerceId,
      name,
      type,
      tag,
      online,
      order,
      companyInfo
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update company',
    description: 'Updates company configuration and information',
  })
  @ApiParam({ name: 'id', description: 'Company ID', example: 'company-123' })
  @ApiBody({ type: Company })
  @ApiResponse({ status: 200, description: 'Company updated successfully', type: Company })
  @ApiResponse({ status: 404, description: 'Company not found' })
  public async updateCompany(
    @User() user,
    @Param() params: any,
    @Body() body: Company
  ): Promise<Company> {
    const { id } = params;
    const { name, tag, order, active, available, online, companyInfo } = body;
    return this.companyService.updateCompanyConfigurations(
      user,
      id,
      name,
      tag,
      order,
      active,
      available,
      online,
      companyInfo
    );
  }
}
