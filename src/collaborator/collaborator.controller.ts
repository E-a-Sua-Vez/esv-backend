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

import { CollaboratorService } from './collaborator.service';
import { CollaboratorDetailsDto } from './dto/collaborator-details.dto';
import { Collaborator } from './model/collaborator.entity';

@ApiTags('collaborator')
@Controller('collaborator')
export class CollaboratorController {
  constructor(private readonly collaboratorService: CollaboratorService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get collaborator by ID',
    description: 'Retrieves a collaborator by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Collaborator ID', example: 'collaborator-123' })
  @ApiResponse({ status: 200, description: 'Collaborator found', type: Collaborator })
  @ApiResponse({ status: 404, description: 'Collaborator not found' })
  public async getCollaboratorById(@Param() params: any): Promise<Collaborator> {
    const { id } = params;
    return this.collaboratorService.getCollaboratorById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/details/:id')
  @ApiOperation({
    summary: 'Get collaborator details',
    description: 'Retrieves detailed collaborator information',
  })
  @ApiParam({ name: 'id', description: 'Collaborator ID', example: 'collaborator-123' })
  @ApiResponse({ status: 200, description: 'Collaborator details', type: Collaborator })
  public async getCollaboratorDetailsById(@Param() params: any): Promise<Collaborator> {
    const { id } = params;
    return this.collaboratorService.getCollaboratorDetailsById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({
    summary: 'Get all collaborators',
    description: 'Retrieves a list of all collaborators',
  })
  @ApiResponse({ status: 200, description: 'List of collaborators', type: [Collaborator] })
  public async getCollaborators(): Promise<Collaborator[]> {
    return this.collaboratorService.getCollaborators();
  }

  @Get('/email/:email')
  @ApiOperation({
    summary: 'Get collaborator by email',
    description: 'Retrieves a collaborator by email address',
  })
  @ApiParam({
    name: 'email',
    description: 'Collaborator email',
    example: 'collaborator@example.com',
  })
  @ApiResponse({ status: 200, description: 'Collaborator found', type: Collaborator })
  public async getCollaboratorByEmail(@Param() params: any): Promise<Collaborator> {
    const { email } = params;
    return this.collaboratorService.getCollaboratorByEmail(email);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/commerceId/:commerceId')
  @ApiOperation({
    summary: 'Get collaborators by commerce ID',
    description: 'Retrieves all collaborators for a specific commerce',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiResponse({
    status: 200,
    description: 'List of collaborators',
    type: [CollaboratorDetailsDto],
  })
  public async getCollaboratorsByCommerceId(
    @Param() params: any
  ): Promise<CollaboratorDetailsDto[]> {
    const { commerceId } = params;
    return this.collaboratorService.getCollaboratorsByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @Get('/details/commerceId/:commerceId')
  public async getDetailsCollaboratorsByCommerceId(
    @Param() params: any
  ): Promise<CollaboratorDetailsDto[]> {
    const { commerceId } = params;
    return this.collaboratorService.getDetailsCollaboratorsByCommerceId(commerceId);
  }

  @UseGuards(AuthGuard)
  @Get('/commerceId/:commerceId/email/:email')
  public async getCollaboratorsByCommerceIdAndEmail(@Param() params: any): Promise<Collaborator> {
    const { commerceId, email } = params;
    return this.collaboratorService.getCollaboratorsByCommerceIdAndEmail(commerceId, email);
  }

  @UseGuards(AuthGuard)
  @Patch('/:id')
  public async updateCollaborator(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Collaborator> {
    const { id } = params;
    const { name, type, alias, phone, moduleId, active, available, servicesId, commercesId } = body;
    return this.collaboratorService.updateCollaborator(
      user,
      id,
      name,
      moduleId,
      phone,
      active,
      available,
      alias,
      servicesId,
      type,
      commercesId
    );
  }

  @UseGuards(AuthGuard)
  @Patch('/desactivate/:id')
  public async desactivate(@User() user, @Param() params: any): Promise<Collaborator> {
    const { id } = params;
    return this.collaboratorService.changeStatus(user, id, false);
  }

  @UseGuards(AuthGuard)
  @Patch('/activate/:id')
  public async activate(@User() user, @Param() params: any): Promise<Collaborator> {
    const { id } = params;
    return this.collaboratorService.changeStatus(user, id, true);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new collaborator',
    description: 'Creates a new collaborator account',
  })
  @ApiBody({ type: Collaborator })
  @ApiResponse({
    status: 201,
    description: 'Collaborator created successfully',
    type: Collaborator,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createCollaborator(@User() user, @Body() body: Collaborator): Promise<Collaborator> {
    const { name, commerceId, commercesId, email, type, phone, moduleId, bot, alias, servicesId } =
      body;
    return this.collaboratorService.createCollaborator(
      user,
      name,
      commerceId,
      commercesId,
      email,
      type,
      phone,
      moduleId,
      bot,
      alias,
      servicesId
    );
  }

  @Patch('/register-token/:id')
  public async registerToken(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Collaborator> {
    const { id } = params;
    const { token } = body;
    return this.collaboratorService.updateToken(user, id, token);
  }

  @Patch('/change-password/:id')
  public async changePassword(@User() user, @Param() params: any): Promise<Collaborator> {
    const { id } = params;
    return this.collaboratorService.changePassword(user, id);
  }

  @UseGuards(AuthGuard)
  @Patch('/:id/permission')
  public async updateCollaboratorPermission(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Collaborator> {
    const { id } = params;
    const { name, value } = body;
    return this.collaboratorService.updateCollaboratorPermission(user, id, name, value);
  }
}
