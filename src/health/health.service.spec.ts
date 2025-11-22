import { Test, TestingModule } from '@nestjs/testing';

import { HealthOutputDto } from './dto/health-output.dto';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  describe('getHealth', () => {
    it('should return health status', () => {
      // Act
      const result = service.getHealth();

      // Assert
      expect(result).toBeDefined();
      expect(result.message).toBe('ett-backend is up');
      expect(result.environment).toBeDefined();
    });

    it('should return environment from process.env or default to local', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      // Act
      const result = service.getHealth();

      // Assert
      expect(result.environment).toBe('local');

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should return environment from process.env when set', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Act
      const result = service.getHealth();

      // Assert
      expect(result.environment).toBe('production');

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });
  });
});
