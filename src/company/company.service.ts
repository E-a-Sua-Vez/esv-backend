import { Company, CompanyInfo } from './model/company.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import CompanyCreated from './events/CompanyCreated';
import CompanyUpdated from './events/CompanyUpdated';
import { CompanyType } from './model/company-type.enum';

@Injectable()
export class CompanyService {
  constructor(
  @InjectRepository(Company)
    private companyRepository = getRepository(Company)
  ) {}

  public async getCompanyById(id: string): Promise<Company> {
    let company = await this.companyRepository.findById(id);
    return company;
  }

  public async getCompanies(): Promise<Company[]> {
    let companys: Company[] = [];
    companys = await this.companyRepository.find();
    return companys;
  }

  public async getCompanyByCommerce(commerceId: string): Promise<Company[]> {
    let companys: Company[] = [];
    companys = await this.companyRepository
      .whereEqualTo('commerceId', commerceId)
      .orderByAscending('order')
      .whereEqualTo('available', true)
      .find();
    return companys;
  }

  public async getCompaniesById(companysId: string[]): Promise<Company[]> {
    let companys: Company[] = [];
    companys = await this.companyRepository
      .whereIn('id', companysId)
      .whereEqualTo('available', true)
      .orderByAscending('order')
      .find();
    return companys;
  }

  public async getActiveCompaniesByCommerce(commerceId: string): Promise<Company[]> {
    let companys: Company[] = [];
    companys = await this.companyRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .orderByAscending('order')
      .find();
    return companys;
  }

  public async getActiveCompaniesByCommerceAndType(commerceId: string, type: CompanyType): Promise<Company[]> {
    let companys: Company[] = [];
    companys = await this.companyRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('type', type)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .orderByAscending('order')
      .find();
    return companys;
  }

  public async getOnlineCompaniesByCommerce(commerceId: string): Promise<Company[]> {
    let companys: Company[] = [];
    companys = await this.companyRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .whereEqualTo('online', true)
      .orderByAscending('order')
      .find();
    return companys;
  }

  public async updateCompanyConfigurations(user: string, id: string, name: string, tag: string, order: number, active: boolean, available: boolean, online: boolean, companyInfo: CompanyInfo): Promise<Company> {
    try {
      let company = await this.companyRepository.findById(id);
      if (name) {
        company.name = name;
      }
      if (tag) {
        company.tag = tag;
      }
      if (order) {
        company.order = order;
      }
      if (active !== undefined) {
        company.active = active;
      }
      if (available !== undefined) {
        company.available = available;
      }
      if (online !== undefined) {
        company.online = online;
      }
      if (companyInfo !== undefined) {
        company.companyInfo = companyInfo;
      }
      return await this.updateCompany(user, company);
    } catch (error) {
      throw new HttpException(`Hubo un problema al modificar el servicio: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async updateCompany(user: string, company: Company): Promise<Company> {
    const companyUpdated = await await this.companyRepository.update(company);
    const companyUpdatedEvent = new CompanyUpdated(new Date(), companyUpdated, { user });
    publish(companyUpdatedEvent);
    return companyUpdated;
  }

  public async createCompany(user: string, commerceId: string, name: string, type: CompanyType, tag: string, online: boolean, order: number, companyInfo: CompanyInfo): Promise<Company> {
    let company = new Company();
    company.commerceId = commerceId;
    company.name = name;
    company.type = type || CompanyType.STANDARD;
    company.tag = tag;
    company.online = online;
    company.active = true;
    company.available = true;
    company.createdAt = new Date();
    company.order = order;
    company.companyInfo = companyInfo;
    const companyCreated = await this.companyRepository.create(company);
    const companyCreatedEvent = new CompanyCreated(new Date(), companyCreated, { user });
    publish(companyCreatedEvent);
    return companyCreated;
  }
}
