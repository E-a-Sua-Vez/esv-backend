import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';

import { LaboratoryService } from '../../laboratory/laboratory.service';

@Injectable()
export class HL7ApiKeyGuard implements CanActivate {
  constructor(private readonly laboratoryService: LaboratoryService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Get API Key from header
    const apiKey = request.headers['x-api-key'] || request.headers['api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API Key is required');
    }

    try {
      // Validate API Key and get laboratory
      const laboratory = await this.laboratoryService.getLaboratoryByApiKey(apiKey);

      // Attach laboratory to request for use in controller/service
      request.laboratory = laboratory;

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid API Key');
    }
  }
}
