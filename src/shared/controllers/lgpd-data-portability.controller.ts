import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';

import { User } from '../../auth/user.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { LgpdDataPortabilityService } from '../services/lgpd-data-portability.service';

/**
 * Controlador de portabilidade de dados LGPD
 * Conformidade: LGPD (Lei 13.709/2018) - Artigo 18, inciso V
 */
@ApiTags('lgpd-data-portability')
@Controller('lgpd-data-portability')
export class LgpdDataPortabilityController {
  constructor(private readonly dataPortabilityService: LgpdDataPortabilityService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/:commerceId/:clientId/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gerar arquivo de portabilidade de dados',
    description: 'Gera um arquivo com todos os dados do paciente em formato estruturado (LGPD)',
  })
  @ApiParam({ name: 'commerceId', description: 'ID do comércio' })
  @ApiParam({ name: 'clientId', description: 'ID do cliente' })
  @ApiResponse({
    status: 200,
    description: 'Arquivo de portabilidade gerado com sucesso',
  })
  @ApiResponse({
    status: 403,
    description: 'Cliente não possui consentimento para exportação de dados',
  })
  async generateDataPortabilityFile(
    @User() user: any,
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string
  ) {
    return this.dataPortabilityService.generateDataPortabilityFile(
      user.id || user.userId || user,
      commerceId,
      clientId
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:commerceId/:clientId/download')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Download do arquivo de portabilidade',
    description: 'Faz download do arquivo de portabilidade de dados',
  })
  @ApiParam({ name: 'commerceId', description: 'ID do comércio' })
  @ApiParam({ name: 'clientId', description: 'ID do cliente' })
  @ApiResponse({
    status: 200,
    description: 'Arquivo de portabilidade',
  })
  async downloadDataPortabilityFile(
    @User() user: any,
    @Param('commerceId') commerceId: string,
    @Param('clientId') clientId: string,
    @Res() res: Response
  ) {
    const result = await this.dataPortabilityService.generateDataPortabilityFile(
      user.id || user.userId || user,
      commerceId,
      clientId
    );

    // Extrair dados do data URL
    const base64Data = result.fileUrl.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  }
}

