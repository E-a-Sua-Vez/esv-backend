import { Controller, Get, UseGuards } from '@nestjs/common';
import { HealthOutputDto } from './dto/health-output.dto';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  public getHealth(): HealthOutputDto {
    return this.healthService.getHealth();
  }
}
