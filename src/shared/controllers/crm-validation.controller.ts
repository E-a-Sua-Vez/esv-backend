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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { AuthGuard } from '../../auth/auth.guard';
import { CrmValidationService } from '../services/crm-validation.service';

@ApiTags('crm-validation')
@Controller('crm-validation')
export class CrmValidationController {
  constructor(private readonly crmValidationService: CrmValidationService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar CRM',
    description: 'Valida formato e (quando possível) verifica CRM com conselho regional',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        crm: { type: 'string', description: 'Número do CRM' },
        state: { type: 'string', description: 'Estado do CRM (ex: SP, RJ, MG)' },
        doctorName: { type: 'string', description: 'Nome do médico (opcional)' },
      },
      required: ['crm', 'state'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado da validação',
  })
  async validateCrm(
    @Body() body: { crm: string; state: string; doctorName?: string }
  ) {
    return this.crmValidationService.validateCrm(body.crm, body.state, body.doctorName);
  }

  @Get('/state/:state')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter informações do conselho regional',
    description: 'Retorna informações do conselho regional por estado',
  })
  @ApiParam({ name: 'state', description: 'Estado (ex: SP, RJ, MG)' })
  @ApiResponse({
    status: 200,
    description: 'Informações do conselho regional',
  })
  async getRegionalCouncilInfo(@Param('state') state: string) {
    return this.crmValidationService.getRegionalCouncilInfo(state);
  }
}













