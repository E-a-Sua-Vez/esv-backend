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

import { FeatureToggleService } from './feature-toggle.service';
import { FeatureToggle, FeatureToggleOption } from './model/feature-toggle.entity';

@ApiTags('feature-toggle')
@Controller('feature-toggle')
export class FeatureToggleController {
  constructor(private readonly featureToggleService: FeatureToggleService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get feature toggle by ID',
    description: 'Retrieves a feature toggle by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Feature toggle ID', example: 'feature-toggle-123' })
  @ApiResponse({ status: 200, description: 'Feature toggle found', type: FeatureToggle })
  @ApiResponse({ status: 404, description: 'Feature toggle not found' })
  public async getFeatureToggleById(@Param() params: any): Promise<FeatureToggle> {
    const { id } = params;
    return this.featureToggleService.getFeatureToggleById(id);
  }

  @Get('/name/:name')
  @ApiOperation({
    summary: 'Get feature toggle by name',
    description: 'Retrieves a feature toggle by its name',
  })
  @ApiParam({ name: 'name', description: 'Feature toggle name', example: 'new-feature' })
  @ApiResponse({ status: 200, description: 'Feature toggle found', type: FeatureToggle })
  public async getFeatureToggleByName(@Param() params: any): Promise<FeatureToggle> {
    const { name } = params;
    return this.featureToggleService.getFeatureToggleByName(name);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/options/all')
  @ApiOperation({
    summary: 'Get all feature toggle options',
    description: 'Retrieves all available feature toggle options',
  })
  @ApiResponse({
    status: 200,
    description: 'List of feature toggle options',
    type: [FeatureToggleOption],
  })
  public async getFeatureToggleOptions(): Promise<FeatureToggleOption[]> {
    return this.featureToggleService.getFeatureToggleOptions();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId')
  @ApiOperation({
    summary: 'Get feature toggles by commerce ID',
    description: 'Retrieves all feature toggles for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of feature toggles', type: [FeatureToggle] })
  public async getFeatureToggleByCommerceId(@Param() params: any): Promise<FeatureToggle[]> {
    const { commerceId } = params;
    return this.featureToggleService.getFeatureToggleByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId/name/:name')
  @ApiOperation({
    summary: 'Get feature toggle by commerce and name',
    description: 'Retrieves a specific feature toggle for a commerce by name',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'name', description: 'Feature toggle name', example: 'new-feature' })
  @ApiResponse({ status: 200, description: 'Feature toggle found', type: FeatureToggle })
  public async getFeatureToggleByNameAndCommerceId(@Param() params: any): Promise<FeatureToggle> {
    const { commerceId, name } = params;
    return this.featureToggleService.getFeatureToggleByNameAndCommerceId(commerceId, name);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new feature toggle',
    description: 'Creates a new feature toggle for a commerce',
  })
  @ApiBody({ type: FeatureToggle })
  @ApiResponse({
    status: 201,
    description: 'Feature toggle created successfully',
    type: FeatureToggle,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createFeatureToggle(
    @User() user,
    @Body() body: FeatureToggle
  ): Promise<FeatureToggle> {
    const { name, commerceId, type } = body;
    return this.featureToggleService.createFeatureToggle(user, name, commerceId, type);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update feature toggle',
    description: 'Updates the active status of a feature toggle',
  })
  @ApiParam({ name: 'id', description: 'Feature toggle ID', example: 'feature-toggle-123' })
  @ApiBody({ type: FeatureToggle })
  @ApiResponse({
    status: 200,
    description: 'Feature toggle updated successfully',
    type: FeatureToggle,
  })
  @ApiResponse({ status: 404, description: 'Feature toggle not found' })
  public async updateFeatureToggle(
    @User() user,
    @Param() params: any,
    @Body() body: FeatureToggle
  ): Promise<FeatureToggle> {
    const { id } = params;
    const { active } = body;
    return this.featureToggleService.updateFeatureToggle(user, id, active);
  }
}
