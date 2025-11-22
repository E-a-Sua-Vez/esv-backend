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
import { ClientContact } from 'src/client-contact/model/client-contact.entity';

import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/user.decorator';

import { ClientService } from './client.service';
import { ClientSearchDto } from './dto/client-search.dto';
import { Client } from './model/client.entity';

@ApiTags('client')
@Controller('client')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get client by ID',
    description: 'Retrieves a client by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Client ID', example: 'client-123' })
  @ApiResponse({ status: 200, description: 'Client found', type: Client })
  @ApiResponse({ status: 404, description: 'Client not found' })
  public async getClientById(@Param() params: any): Promise<Client> {
    const { id } = params;
    return this.clientService.getClientById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('search/commerceId/:commerceId/idNumber/:idNumber')
  @ApiOperation({
    summary: 'Search client by ID number',
    description: 'Searches for a client by commerce and ID number',
  })
  @ApiParam({ name: 'commerceId', description: 'Commerce ID', example: 'commerce-123' })
  @ApiParam({ name: 'idNumber', description: 'Client ID number', example: '12345678-9' })
  @ApiResponse({ status: 200, description: 'Client search result', type: ClientSearchDto })
  public async searchClient(@Param() params: any): Promise<ClientSearchDto> {
    const { commerceId, idNumber } = params;
    return this.clientService.searchClient(commerceId, idNumber);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/contact/:id')
  @ApiOperation({
    summary: 'Contact client',
    description: 'Records a contact attempt with a client',
  })
  @ApiParam({ name: 'id', description: 'Client ID', example: 'client-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        result: { type: 'string', example: 'INTERESTED' },
        type: { type: 'string', example: 'CALL' },
        comment: { type: 'string', example: 'Client showed interest' },
        commerceId: { type: 'string', example: 'commerce-123' },
        collaboratorId: { type: 'string', example: 'collaborator-123' },
      },
      required: ['result', 'type'],
    },
  })
  @ApiResponse({ status: 201, description: 'Contact recorded successfully', type: ClientContact })
  public async contactClient(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<ClientContact> {
    const { id } = params;
    const { result, type, comment, commerceId, collaboratorId } = body;
    return this.clientService.contactClient(
      user,
      id,
      type,
      result,
      comment,
      commerceId,
      collaboratorId
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({ summary: 'Update client', description: 'Updates client information' })
  @ApiParam({ name: 'id', description: 'Client ID', example: 'client-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        businessId: { type: 'string' },
        commerceId: { type: 'string' },
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        lastName: { type: 'string' },
        idNumber: { type: 'string' },
        personalInfo: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Client updated successfully', type: Client })
  @ApiResponse({ status: 404, description: 'Client not found' })
  public async updateClient(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Client> {
    const { id } = params;
    const { businessId, commerceId, name, phone, email, lastName, idNumber, personalInfo } = body;
    return this.clientService.updateClient(
      user,
      id,
      businessId,
      commerceId,
      name,
      phone,
      email,
      lastName,
      idNumber,
      personalInfo
    );
  }
}
