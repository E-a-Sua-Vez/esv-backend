import { Injectable } from '@nestjs/common';

import { HealthOutputDto } from './dto/health-output.dto';

@Injectable()
export class HealthService {
  public getHealth(): HealthOutputDto {
    return {
      environment: process.env.NODE_ENV || 'local',
      message: 'ett-backend is up',
    };
  }
}
