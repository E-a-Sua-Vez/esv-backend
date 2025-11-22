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

import { OutcomeType } from './model/outcome-type.entity';
import { OutcomeTypeService } from './outcome-type.service';

@ApiTags('outcome-type')
@Controller('outcome-type')
export class OutcomeTypeController {
  constructor(private readonly outcomeTypeService: OutcomeTypeService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get outcome type by ID',
    description: 'Retrieves an outcome type by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Outcome type ID', example: 'outcome-type-123' })
  @ApiResponse({ status: 200, description: 'Outcome type found', type: OutcomeType })
  @ApiResponse({ status: 404, description: 'Outcome type not found' })
  public async getOutcomeTypeById(@Param() params: any): Promise<OutcomeType> {
    const { id } = params;
    return this.outcomeTypeService.getOutcomeTypeById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({
    summary: 'Get all outcome types',
    description: 'Retrieves a list of all outcome types',
  })
  @ApiResponse({ status: 200, description: 'List of outcome types', type: [OutcomeType] })
  public async getOutcomeTypes(): Promise<OutcomeType[]> {
    return this.outcomeTypeService.getOutcomeTypes();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId')
  @ApiOperation({
    summary: 'Get outcome types by commerce',
    description: 'Retrieves all outcome types for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({ status: 200, description: 'List of outcome types', type: [OutcomeType] })
  public async getOutcomeTypeByCommerce(@Param() params: any): Promise<OutcomeType[]> {
    const { commerceId } = params;
    return this.outcomeTypeService.getOutcomeTypeByCommerce(commerceId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/list/:ids')
  @ApiOperation({
    summary: 'Get outcome types by IDs',
    description: 'Retrieves multiple outcome types by their IDs (comma-separated)',
  })
  @ApiParam({
    name: 'ids',
    description: 'Comma-separated outcome type IDs',
    example: 'type-1,type-2,type-3',
  })
  @ApiResponse({ status: 200, description: 'List of outcome types', type: [OutcomeType] })
  public async getOutcomeTypesById(@Param() params: any): Promise<OutcomeType[]> {
    const { ids } = params;
    return this.outcomeTypeService.getOutcomeTypesById(ids.split(','));
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new outcome type',
    description: 'Creates a new outcome type category',
  })
  @ApiBody({ type: OutcomeType })
  @ApiResponse({ status: 201, description: 'Outcome type created successfully', type: OutcomeType })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createOutcomeType(@User() user, @Body() body: OutcomeType): Promise<OutcomeType> {
    const { commerceId, type, name, tag } = body;
    return this.outcomeTypeService.createOutcomeType(user, commerceId, type, name, tag);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update outcome type',
    description: 'Updates outcome type configuration',
  })
  @ApiParam({ name: 'id', description: 'Outcome type ID', example: 'outcome-type-123' })
  @ApiBody({ type: OutcomeType })
  @ApiResponse({ status: 200, description: 'Outcome type updated successfully', type: OutcomeType })
  @ApiResponse({ status: 404, description: 'Outcome type not found' })
  public async updateOutcomeType(
    @User() user,
    @Param() params: any,
    @Body() body: OutcomeType
  ): Promise<OutcomeType> {
    const { id } = params;
    const { type, name, tag, active, available } = body;
    return this.outcomeTypeService.updateOutcomeTypeConfigurations(
      user,
      id,
      name,
      tag,
      active,
      available
    );
  }
}
