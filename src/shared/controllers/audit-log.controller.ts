import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { AuthGuard } from '../../auth/auth.guard';
import { AuditLogService } from '../services/audit-log.service';
import { AuditLog } from '../model/audit-log.entity';

@ApiTags('audit-log')
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/entity/:entityType/:entityId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter logs de auditoria por entidade',
    description: 'Retorna logs de auditoria para uma entidade específica',
  })
  @ApiParam({ name: 'entityType', description: 'Tipo da entidade' })
  @ApiParam({ name: 'entityId', description: 'ID da entidade' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limite de resultados' })
  @ApiResponse({
    status: 200,
    description: 'Logs de auditoria',
    type: [AuditLog],
  })
  async getLogsByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('limit') limit?: number
  ): Promise<AuditLog[]> {
    return this.auditLogService.getLogsByEntity(entityType, entityId, limit || 100);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/user/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter logs de auditoria por usuário',
    description: 'Retorna logs de auditoria para um usuário específico',
  })
  @ApiParam({ name: 'userId', description: 'ID do usuário' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Logs de auditoria',
    type: [AuditLog],
  })
  async getLogsByUser(
    @Param('userId') userId: string,
    @Query('limit') limit?: number
  ): Promise<AuditLog[]> {
    return this.auditLogService.getLogsByUser(userId, limit || 100);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/action/:action')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter logs de auditoria por ação',
    description: 'Retorna logs de auditoria para uma ação específica',
  })
  @ApiParam({ name: 'action', description: 'Tipo de ação' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Logs de auditoria',
    type: [AuditLog],
  })
  async getLogsByAction(
    @Param('action') action: AuditLog['action'],
    @Query('limit') limit?: number
  ): Promise<AuditLog[]> {
    return this.auditLogService.getLogsByAction(action, limit || 100);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gerar relatório de auditoria',
    description: 'Gera relatório completo de auditoria com filtros',
  })
  @ApiQuery({ name: 'businessId', required: false, type: String })
  @ApiQuery({ name: 'commerceId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'entityId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Relatório de auditoria',
  })
  async generateAuditReport(
    @Query('businessId') businessId?: string,
    @Query('commerceId') commerceId?: string,
    @Query('userId') userId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: AuditLog['action'],
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.auditLogService.generateAuditReport({
      businessId,
      commerceId,
      userId,
      entityType,
      entityId,
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }
}




