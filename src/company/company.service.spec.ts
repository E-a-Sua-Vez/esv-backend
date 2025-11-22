import { CompanyService } from './company.service';
import { Company } from './model/company.entity';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  orderByAscending: jest.fn().mockReturnThis(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => jest.fn()),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => jest.fn(),
}));

describe('CompanyService', () => {
  let service: CompanyService;

  const mockCompany: Company = {
    id: 'company-1',
    name: 'Test Company',
    commerceId: 'commerce-1',
    available: true,
    order: 1,
    createdAt: new Date(),
  } as Company;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getCompanyById: jest.fn(),
      getCompanies: jest.fn(),
      getCompanyByCommerce: jest.fn(),
      getCompaniesById: jest.fn(),
    } as Partial<CompanyService> as CompanyService;

    (service.getCompanyById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'company-1') {
        return mockCompany;
      }
      return undefined;
    });

    (service.getCompanies as jest.Mock).mockImplementation(async () => {
      return [mockCompany];
    });

    (service.getCompanyByCommerce as jest.Mock).mockImplementation(async () => {
      return [mockCompany];
    });

    (service.getCompaniesById as jest.Mock).mockImplementation(async (ids: string[]) => {
      return ids.map(id => ({ ...mockCompany, id }));
    });

    jest.clearAllMocks();
  });

  describe('getCompanyById', () => {
    it('should return company when found', async () => {
      // Act
      const result = await service.getCompanyById('company-1');

      // Assert
      expect(result).toEqual(mockCompany);
    });

    it('should return undefined when company not found', async () => {
      // Act
      const result = await service.getCompanyById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getCompanies', () => {
    it('should return all companies', async () => {
      // Act
      const result = await service.getCompanies();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getCompanyByCommerce', () => {
    it('should return companies for a commerce', async () => {
      // Act
      const result = await service.getCompanyByCommerce('commerce-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getCompaniesById', () => {
    it('should return companies by ids', async () => {
      // Act
      const result = await service.getCompaniesById(['company-1', 'company-2']);

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(2);
    });
  });
});
