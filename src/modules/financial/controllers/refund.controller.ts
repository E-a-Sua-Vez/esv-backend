import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../../auth/auth.guard';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { RefundResponse, ProcessRefundResult } from '../interfaces/refund.interfaces';
import { RefundService } from '../services/refund.service';
import { User } from '../../../auth/user.decorator';

@ApiTags('refunds')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@Controller('refunds')
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Procesar un reembolso' })
  @ApiResponse({ status: 201, description: 'Reembolso procesado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Transacción original no encontrada' })
  async createRefund(
    @Body() createRefundDto: CreateRefundDto,
    @User() user: any
  ): Promise<ProcessRefundResult> {
    try {
      return await this.refundService.processRefund(createRefundDto, user.commerceId);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Obtener lista de reembolsos' })
  @ApiResponse({ status: 200, description: 'Lista de reembolsos' })
  async getRefunds(
    @User() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
    @Query('status') status?: string
  ): Promise<{ refunds: RefundResponse[]; total: number; page: number; limit: number }> {
    return await this.refundService.getRefunds(user.commerceId, {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      type,
      status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de un reembolso específico' })
  @ApiResponse({ status: 200, description: 'Detalles del reembolso' })
  @ApiResponse({ status: 404, description: 'Reembolso no encontrado' })
  async getRefundById(
    @Param('id') id: string,
    @User() user: any
  ): Promise<RefundResponse> {
    return await this.refundService.getRefundById(id, user.commerceId);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprobar un reembolso pendiente' })
  @ApiResponse({ status: 200, description: 'Reembolso aprobado' })
  @ApiResponse({ status: 404, description: 'Reembolso no encontrado' })
  async approveRefund(
    @Param('id') id: string,
    @User() user: any
  ): Promise<{ success: boolean; message: string }> {
    return await this.refundService.approveRefund(id, user.commerceId);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rechazar un reembolso pendiente' })
  @ApiResponse({ status: 200, description: 'Reembolso rechazado' })
  @ApiResponse({ status: 404, description: 'Reembolso no encontrado' })
  async rejectRefund(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @User() user: any
  ): Promise<{ success: boolean; message: string }> {
    return await this.refundService.rejectRefund(id, user.commerceId, body.reason);
  }
}