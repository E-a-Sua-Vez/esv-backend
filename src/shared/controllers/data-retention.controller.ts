import { Controller, Get, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { User } from '../../auth/user.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { DataRetentionService } from '../services/data-retention.service';

/**
 * Controlador de retenção de dados
 */
@ApiTags('data-retention')
@Controller('data-retention')
export class DataRetentionController {
  constructor(private readonly dataRetentionService: DataRetentionService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar documentos que precisam ser arquivados',
    description: 'Retorna contagem de documentos que estão próximos ou passaram do prazo de retenção',
  })
  @ApiResponse({
    status: 200,
    description: 'Contagem de documentos para arquivamento',
  })
  async checkRetention() {
    return this.dataRetentionService.checkRetentionManually();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Arquivar documentos antigos manualmente',
    description: 'Executa o processo de arquivamento de documentos que passaram do prazo de retenção',
  })
  @ApiResponse({
    status: 200,
    description: 'Arquivamento concluído',
  })
  async archiveOldDocuments(@User() user: any) {
    await this.dataRetentionService.archiveOldDocuments();
    return { success: true, message: 'Arquivamento concluído' };
  }
}

