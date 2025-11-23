import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { HealthOutputDto } from './dto/health-output.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Health check', description: 'Returns the health status of the API' })
  @ApiResponse({ status: 200, description: 'Service is healthy', type: HealthOutputDto })
  public getHealth(): HealthOutputDto {
    return this.healthService.getHealth();
  }
}
