import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/auth/user.decorator';

import { SimpleGuard } from '../auth/simple.guard';

import { AttentionService } from './attention.service';
import { AttentionDetailsDto } from './dto/attention-details.dto';
import { Attention } from './model/attention.entity';

@ApiTags('attention')
@Controller('attention')
export class AttentionController {
  constructor(private readonly attentionService: AttentionService) {}

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/:id')
  @ApiOperation({
    summary: 'Get attention by ID',
    description: 'Retrieves an attention record by its unique identifier',
  })
  @ApiParam({ name: 'id', description: 'Attention ID', example: 'attention-123' })
  @ApiResponse({ status: 200, description: 'Attention found', type: Attention })
  @ApiResponse({ status: 404, description: 'Attention not found' })
  public async getAttentionById(@Param() params: any): Promise<Attention> {
    const { id } = params;
    return this.attentionService.getAttentionById(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('/details/:id')
  @ApiOperation({
    summary: 'Get attention details',
    description: 'Retrieves detailed attention information',
  })
  @ApiParam({ name: 'id', description: 'Attention ID', example: 'attention-123' })
  @ApiResponse({ status: 200, description: 'Attention details', type: AttentionDetailsDto })
  @ApiResponse({ status: 404, description: 'Attention not found' })
  public async getAttentionDetails(@Param() params: any): Promise<AttentionDetailsDto> {
    const { id } = params;
    return this.attentionService.getAttentionDetails(id);
  }

  @UseGuards(AuthGuard)
  @Get('/details/queue/:queueId/number/:number/status/:status')
  public async getAttentionDetailsByNumber(@Param() params: any): Promise<AttentionDetailsDto> {
    const { queueId, number, status } = params;
    return this.attentionService.getAttentionDetailsByNumber(number, status, queueId);
  }

  @UseGuards(AuthGuard)
  @Get('/available/details/queue/:queueId/number/:number')
  public async getAvailableAttentionDetailsByNumber(
    @Param() params: any
  ): Promise<AttentionDetailsDto> {
    const { queueId, number } = params;
    return this.attentionService.getAvailableAttentionDetailsByNumber(number, queueId);
  }

  @UseGuards(AuthGuard)
  @Get('/next/available/details/queue/:queueId')
  public async getNextAvailableAttentionDetails(
    @Param() params: any
  ): Promise<AttentionDetailsDto> {
    const { queueId } = params;
    return this.attentionService.getNextAvailableAttentionDetails(queueId);
  }

  @UseGuards(AuthGuard)
  @Get('/details/queue/:queueId/status/:status')
  public async getAttentionDetailsByQueue(@Param() params: any): Promise<AttentionDetailsDto[]> {
    const { queueId, status } = params;
    return this.attentionService.getAttentionDetailsByQueueAndStatuses(status, queueId);
  }

  @UseGuards(AuthGuard)
  @Get('/available/details/queue/:queueId')
  public async getAvailableAttentiosnByQueue(@Param() params: any): Promise<AttentionDetailsDto[]> {
    const { queueId } = params;
    return this.attentionService.getAvailableAttentionDetailsByQueues(queueId);
  }

  @UseGuards(AuthGuard)
  @Get('/queue/:queueId/date/:date')
  public async getAttentionByDate(@Param() params: any): Promise<Attention[]> {
    const { queueId, date } = params;
    return this.attentionService.getAttentionByDate(queueId, date);
  }

  @UseGuards(AuthGuard)
  @Get('/processing/details/queue/:queueId')
  public async getProcessingAttentionDetailsByQueue(
    @Param() params: any
  ): Promise<AttentionDetailsDto[]> {
    const { queueId } = params;
    return this.attentionService.getProcessingAttentionDetailsByQueue(queueId);
  }

  @UseGuards(AuthGuard)
  @Post()
  public async createAttention(@Body() body: any): Promise<Attention> {
    const {
      queueId,
      collaboratorId,
      channel,
      user,
      type,
      block,
      servicesId,
      servicesDetails,
      clientId,
    } = body;
    return this.attentionService.createAttention(
      queueId,
      collaboratorId,
      channel,
      user,
      type,
      block,
      undefined,
      undefined,
      undefined,
      servicesId,
      servicesDetails,
      clientId
    );
  }

  @UseGuards(AuthGuard)
  @Patch('/:number')
  public async attend(@User() user, @Param() params: any, @Body() body: any): Promise<Attention> {
    const { number } = params;
    const { collaboratorId, queueId, commerceLanguage } = body;
    return this.attentionService.attend(
      user,
      parseInt(number),
      queueId,
      collaboratorId,
      commerceLanguage
    );
  }

  @UseGuards(AuthGuard)
  @Patch('/skip/:number')
  public async skip(@User() user, @Param() params: any, @Body() body: any): Promise<Attention> {
    const { number } = params;
    const { collaboratorId, queueId } = body;
    return this.attentionService.skip(user, parseInt(number), queueId, collaboratorId);
  }

  @UseGuards(AuthGuard)
  @Patch('/finish/:id')
  public async finishAttention(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Attention> {
    const { id } = params;
    const { comment } = body;
    return this.attentionService.finishAttention(user, id, comment);
  }

  @UseGuards(AuthGuard)
  @Patch('/finish-cancelled/:id')
  public async finishCancelledAttention(@User() user, @Param() params: any): Promise<Attention> {
    const { id } = params;
    return this.attentionService.finishCancelledAttention(user, id);
  }

  @UseGuards(AuthGuard)
  @Patch('/reactivate/:number')
  public async reactivate(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Attention> {
    const { number } = params;
    const { collaboratorId, queueId } = body;
    return this.attentionService.reactivate(user, parseInt(number), queueId, collaboratorId);
  }

  @UseGuards(AuthGuard)
  @Patch('/notification/:id')
  public async saveDataNotification(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Attention> {
    const { id } = params;
    const {
      name,
      phone,
      email,
      commerceId,
      queueId,
      lastName,
      idNumber,
      notificationOn,
      notificationEmailOn,
    } = body;
    return this.attentionService.saveDataNotification(
      user,
      id,
      name,
      phone,
      email,
      commerceId,
      queueId,
      lastName,
      idNumber,
      notificationOn,
      notificationEmailOn
    );
  }

  @UseGuards(AuthGuard)
  @Patch('/no-device/:id')
  public async setNoDevice(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Attention> {
    const { id } = params;
    const { name, assistingCollaboratorId, commerceId, queueId } = body;
    return this.attentionService.setNoDevice(
      user,
      id,
      assistingCollaboratorId,
      name,
      commerceId,
      queueId
    );
  }

  @UseGuards(SimpleGuard)
  @Patch('/cancell/all')
  public async cancellAtentions(): Promise<string> {
    return this.attentionService.cancellAtentions();
  }

  @UseGuards(AuthGuard)
  @Patch('/cancel/:id')
  public async cancelAttention(@User() user, @Param() params: any): Promise<Attention> {
    const { id } = params;
    return this.attentionService.cancelAttention(user, id);
  }

  @UseGuards(AuthGuard)
  @Patch('/payment-confirm/:id')
  public async attentionPaymentConfirm(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Attention> {
    const { id } = params;
    const { paymentConfirmationData } = body;
    return this.attentionService.attentionPaymentConfirm(user, id, paymentConfirmationData);
  }

  @UseGuards(AuthGuard)
  @Patch('/transfer/:id')
  public async transferAttentionToQueue(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Attention> {
    const { id } = params;
    const { queueId } = body;
    return this.attentionService.transferAttentionToQueue(user, id, queueId);
  }

  @UseGuards(AuthGuard)
  @Get('/pending/commerce/:commerceId')
  public async getPendingCommerceBookings(@Param() params: any): Promise<any> {
    const { commerceId } = params;
    return this.attentionService.getPendingCommerceAttentions(commerceId);
  }

  //@UseGuards(SimpleGuard)
  @Post('/scheduled-surveys')
  public async surveyPostAttention(@Body() body: any): Promise<any> {
    const { date } = body;
    return this.attentionService.surveyPostAttention(date);
  }
}
