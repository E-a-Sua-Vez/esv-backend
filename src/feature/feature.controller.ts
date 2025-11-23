import {
  Body,
  Controller,
  Get,
  Param,
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

import { Feature } from './feature.entity';
import { FeatureService } from './feature.service';

@ApiTags('feature')
@Controller('feature')
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get feature by ID',
    description: 'Retrieves a feature by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Feature ID', example: 'feature-123' })
  @ApiResponse({ status: 200, description: 'Feature found', type: Feature })
  @ApiResponse({ status: 404, description: 'Feature not found' })
  public async getFeatureToggleById(@Param() params: any): Promise<Feature> {
    const { id } = params;
    return this.featureService.getFeatureById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new feature',
    description: 'Creates a new system feature definition',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'new-feature' },
        description: { type: 'string', example: 'Feature description' },
        type: { type: 'string', example: 'MODULE' },
        module: { type: 'string', example: 'module-name' },
      },
      required: ['name', 'type'],
    },
  })
  @ApiResponse({ status: 201, description: 'Feature created successfully', type: Feature })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createFeature(@Body() body: any): Promise<Feature> {
    const { name, description, type, module } = body;
    return this.featureService.createFeature(name, description, type, module);
  }

  @Get('/name/:name')
  @ApiOperation({ summary: 'Get feature by name', description: 'Retrieves a feature by its name' })
  @ApiParam({ name: 'name', description: 'Feature name', example: 'new-feature' })
  @ApiResponse({ status: 200, description: 'Feature found', type: Feature })
  public async getFeatureToggleByName(@Param() params: any): Promise<Feature> {
    const { name } = params;
    return this.featureService.getFeatureByName(name);
  }

  @Get('/type/:type')
  @ApiOperation({
    summary: 'Get features by type',
    description: 'Retrieves all features of a specific type',
  })
  @ApiParam({ name: 'type', description: 'Feature type', example: 'MODULE' })
  @ApiResponse({ status: 200, description: 'List of features', type: [Feature] })
  public async getFeatureToggleByType(@Param() params: any): Promise<Feature[]> {
    const { type } = params;
    return this.featureService.getFeatureByType(type);
  }

  @Get('/module/:module')
  @ApiOperation({
    summary: 'Get features by module',
    description: 'Retrieves all features for a specific module',
  })
  @ApiParam({ name: 'module', description: 'Module name', example: 'module-name' })
  @ApiResponse({ status: 200, description: 'List of features', type: [Feature] })
  public async getFeatureByModule(@Param() params: any): Promise<Feature[]> {
    const { type } = params;
    return this.featureService.getFeatureByModule(type);
  }
}
