import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CompanyService } from './company.service';
import { Company } from './model/company.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

@Controller('company')
export class CompanyController {
    constructor(private readonly companyService: CompanyService) {
    }

    @UseGuards(AuthGuard)
    @Get('/:id')
    public async getCompanyById(@Param() params: any): Promise<Company> {
        const { id } = params;
        return this.companyService.getCompanyById(id);
    }

    @UseGuards(AuthGuard)
    @Get('/')
    public async getCompanies(): Promise<Company[]> {
        return this.companyService.getCompanies();
    }

    @UseGuards(AuthGuard)
    @Get('/commerce/:commerceId')
    public async getCompanyByCommerce(@Param() params: any): Promise<Company[]> {
        const { commerceId } = params;
        return this.companyService.getCompanyByCommerce(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/active')
    public async getActiveCompaniesByCommerceId(@Param() params: any): Promise<Company[]> {
        const { commerceId } = params;
        return this.companyService.getActiveCompaniesByCommerce(commerceId);
    }

    @UseGuards(AuthGuard)
    @Get('/commerceId/:commerceId/type/:type')
    public async getActiveCompaniesByCommerceIdAndType(@Param() params: any): Promise<Company[]> {
        const { commerceId, type } = params;
        return this.companyService.getActiveCompaniesByCommerceAndType(commerceId, type);
    }

    @UseGuards(AuthGuard)
    @Get('/list/:ids')
    public async getCompaniesById(@Param() params: any): Promise<Company[]> {
        const { ids } = params;
        return this.companyService.getCompaniesById(ids.split(','));
    }

    @UseGuards(AuthGuard)
    @Post('/')
    public async createCompany(@User() user, @Body() body: Company): Promise<Company> {
        const { commerceId, name, type, tag, online, order, companyInfo } = body;
        return this.companyService.createCompany(user, commerceId, name, type, tag, online, order, companyInfo);
    }

    @UseGuards(AuthGuard)
    @Patch('/:id')
    public async updateCompany(@User() user, @Param() params: any, @Body() body: Company): Promise<Company> {
        const { id } = params;
        const { name, tag, order, active, available, online, companyInfo } = body;
        return this.companyService.updateCompanyConfigurations(user, id, name, tag, order, active, available, online, companyInfo);
    }
}