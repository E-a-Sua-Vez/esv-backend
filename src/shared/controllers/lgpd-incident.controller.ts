import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { User } from '../../auth/user.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { LgpdIncidentService } from '../services/lgpd-incident.service';
import {
  LgpdIncident,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
} from '../model/lgpd-incident.entity';

/**
 * Controlador de incidentes LGPD
 * Conformidade: LGPD (Lei 13.709/2018) - Artigo 48
 */
@ApiTags('lgpd-incident')
@Controller('lgpd-incident')
export class LgpdIncidentController {
  constructor(private readonly incidentService: LgpdIncidentService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Criar novo incidente LGPD',
    description: 'Cria um novo registro de incidente de segurança de dados',
  })
  @ApiBody({ type: LgpdIncident })
  @ApiResponse({
    status: 201,
    description: 'Incidente criado com sucesso',
    type: LgpdIncident,
  })
  async createIncident(
    @User() user: any,
    @Body() incident: Partial<LgpdIncident>
  ): Promise<LgpdIncident> {
    return this.incidentService.createIncident(user.id || user.userId || user, incident);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch('/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Atualizar incidente',
    description: 'Atualiza um incidente existente',
  })
  @ApiParam({ name: 'id', description: 'ID do incidente' })
  @ApiBody({ type: LgpdIncident })
  @ApiResponse({
    status: 200,
    description: 'Incidente atualizado com sucesso',
    type: LgpdIncident,
  })
  async updateIncident(
    @User() user: any,
    @Param('id') id: string,
    @Body() updates: Partial<LgpdIncident>
  ): Promise<LgpdIncident> {
    return this.incidentService.updateIncident(
      user.id || user.userId || user,
      id,
      updates
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter incidente por ID',
    description: 'Retorna um incidente específico',
  })
  @ApiParam({ name: 'id', description: 'ID do incidente' })
  @ApiResponse({
    status: 200,
    description: 'Incidente',
    type: LgpdIncident,
  })
  async getIncidentById(@Param('id') id: string): Promise<LgpdIncident> {
    return this.incidentService.getIncidentById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar incidentes',
    description: 'Retorna lista de incidentes com filtros opcionais',
  })
  @ApiQuery({ name: 'commerceId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: IncidentStatus })
  @ApiQuery({ name: 'severity', required: false, enum: IncidentSeverity })
  @ApiQuery({ name: 'incidentType', required: false, enum: IncidentType })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'reportedBy', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Lista de incidentes',
    type: [LgpdIncident],
  })
  async listIncidents(
    @Query('commerceId') commerceId?: string,
    @Query('status') status?: IncidentStatus,
    @Query('severity') severity?: IncidentSeverity,
    @Query('incidentType') incidentType?: IncidentType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('reportedBy') reportedBy?: string,
    @Query('limit') limit?: number
  ): Promise<LgpdIncident[]> {
    return this.incidentService.listIncidents(
      {
        commerceId,
        status: status as IncidentStatus,
        severity: severity as IncidentSeverity,
        incidentType: incidentType as IncidentType,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        reportedBy,
      },
      limit || 100
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/actions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Adicionar ação ao incidente',
    description: 'Registra uma ação tomada em relação ao incidente',
  })
  @ApiParam({ name: 'id', description: 'ID do incidente' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['action', 'description'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Ação adicionada com sucesso',
    type: LgpdIncident,
  })
  async addAction(
    @User() user: any,
    @Param('id') id: string,
    @Body() body: { action: string; description: string }
  ): Promise<LgpdIncident> {
    return this.incidentService.addAction(
      user.id || user.userId || user,
      id,
      body.action,
      body.description
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/preventive-measures')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Adicionar medida preventiva',
    description: 'Registra uma medida preventiva implementada',
  })
  @ApiParam({ name: 'id', description: 'ID do incidente' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        measure: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['measure', 'description'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Medida preventiva adicionada com sucesso',
    type: LgpdIncident,
  })
  async addPreventiveMeasure(
    @User() user: any,
    @Param('id') id: string,
    @Body() body: { measure: string; description: string }
  ): Promise<LgpdIncident> {
    return this.incidentService.addPreventiveMeasure(
      user.id || user.userId || user,
      id,
      body.measure,
      body.description
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/notify-anpd')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar como notificado à ANPD',
    description: 'Registra que o incidente foi notificado à Autoridade Nacional de Proteção de Dados',
  })
  @ApiParam({ name: 'id', description: 'ID do incidente' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reference: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Notificação registrada com sucesso',
    type: LgpdIncident,
  })
  async markAsNotifiedToAnpd(
    @User() user: any,
    @Param('id') id: string,
    @Body() body?: { reference?: string }
  ): Promise<LgpdIncident> {
    return this.incidentService.markAsNotifiedToAnpd(
      user.id || user.userId || user,
      id,
      body?.reference
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:id/notify-data-subjects')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar como notificado aos titulares',
    description: 'Registra que os titulares dos dados foram notificados sobre o incidente',
  })
  @ApiParam({ name: 'id', description: 'ID do incidente' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: ['EMAIL', 'PHONE', 'POSTAL', 'PUBLIC_NOTICE', 'OTHER'],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Notificação registrada com sucesso',
    type: LgpdIncident,
  })
  async markAsNotifiedToDataSubjects(
    @User() user: any,
    @Param('id') id: string,
    @Body() body?: { method?: 'EMAIL' | 'PHONE' | 'POSTAL' | 'PUBLIC_NOTICE' | 'OTHER' }
  ): Promise<LgpdIncident> {
    return this.incidentService.markAsNotifiedToDataSubjects(
      user.id || user.userId || user,
      id,
      body?.method
    );
  }
}

