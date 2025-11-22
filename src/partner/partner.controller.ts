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

import { Partner } from './partner.entity';
import { PartnerService } from './partner.service';

@ApiTags('partner')
@Controller('partner')
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get partner by ID',
    description: 'Retrieves a partner by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Partner ID', example: 'partner-123' })
  @ApiResponse({ status: 200, description: 'Partner found', type: Partner })
  @ApiResponse({ status: 404, description: 'Partner not found' })
  public async getPartnerById(@Param() params: any): Promise<Partner> {
    const { id } = params;
    return this.partnerService.getPartnerById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @ApiOperation({ summary: 'Get all partners', description: 'Retrieves a list of all partners' })
  @ApiResponse({ status: 200, description: 'List of partners', type: [Partner] })
  public async getPartners(): Promise<Partner[]> {
    return this.partnerService.getPartners();
  }

  @Get('/email/:email')
  @ApiOperation({
    summary: 'Get partner by email',
    description: 'Retrieves a partner by email address',
  })
  @ApiParam({ name: 'email', description: 'Partner email', example: 'partner@example.com' })
  @ApiResponse({ status: 200, description: 'Partner found', type: Partner })
  public async getPartnerByEmail(@Param() params: any): Promise<Partner> {
    const { email } = params;
    return this.partnerService.getPartnerByEmail(email);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @ApiOperation({ summary: 'Update partner', description: 'Updates partner information' })
  @ApiParam({ name: 'id', description: 'Partner ID', example: 'partner-123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        alias: { type: 'string' },
        phone: { type: 'string' },
        moduleId: { type: 'string' },
        active: { type: 'boolean' },
        businessIds: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Partner updated successfully', type: Partner })
  public async updatePartner(@Param() params: any, @Body() body: any): Promise<Partner> {
    const { id } = params;
    const { alias, phone, moduleId, active, businessIds } = body;
    return this.partnerService.updatePartner(id, phone, active, alias, businessIds);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/desactivate/:id')
  @ApiOperation({ summary: 'Deactivate partner', description: 'Deactivates a partner account' })
  @ApiParam({ name: 'id', description: 'Partner ID', example: 'partner-123' })
  @ApiResponse({ status: 200, description: 'Partner deactivated successfully', type: Partner })
  public async desactivate(@Param() params: any): Promise<Partner> {
    const { id } = params;
    return this.partnerService.changeStatus(id, false);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/activate/:id')
  @ApiOperation({ summary: 'Activate partner', description: 'Activates a partner account' })
  @ApiParam({ name: 'id', description: 'Partner ID', example: 'partner-123' })
  @ApiResponse({ status: 200, description: 'Partner activated successfully', type: Partner })
  public async activate(@Param() params: any): Promise<Partner> {
    const { id } = params;
    return this.partnerService.changeStatus(id, true);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new partner', description: 'Creates a new partner account' })
  @ApiBody({ type: Partner })
  @ApiResponse({ status: 201, description: 'Partner created successfully', type: Partner })
  @ApiResponse({ status: 400, description: 'Bad request' })
  public async createPartner(@Body() body: Partner): Promise<Partner> {
    const { name, businessIds, email, phone, alias } = body;
    return this.partnerService.createPartner(name, email, phone, businessIds, alias);
  }

  @Patch('/register-token/:id')
  public async registerToken(@Param() params: any, @Body() body: any): Promise<Partner> {
    const { id } = params;
    const { token } = body;
    return this.partnerService.updateToken(id, token);
  }

  @Patch('/change-password/:id')
  public async changePassword(@Param() params: any): Promise<Partner> {
    const { id } = params;
    return this.partnerService.changePassword(id);
  }
}
