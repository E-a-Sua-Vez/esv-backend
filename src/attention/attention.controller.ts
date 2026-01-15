import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
  @Patch('/check-in-call/:id')
  @ApiOperation({
    summary: 'Enviar llamada de check-in por WhatsApp',
    description:
      'Envía un mensaje de WhatsApp al cliente para que se acerque al módulo del colaborador para el check-in de la atención y marca la atención como notificada.',
  })
  @ApiParam({ name: 'id', description: 'Attention ID', example: 'attention-123' })
  @ApiResponse({ status: 200, description: 'Llamada de check-in enviada', type: Attention })
  @ApiResponse({ status: 400, description: 'Datos inválidos o usuario sin teléfono' })
  @ApiResponse({ status: 404, description: 'Atención no encontrada' })
  public async sendCheckInWhatsappCall(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Attention> {
    const { id } = params;
    const { collaboratorId, commerceLanguage } = body;
    return this.attentionService.sendCheckInWhatsappCall(
      typeof user === 'string' ? user : user?.id || user?.userId || 'system',
      id,
      collaboratorId,
      commerceLanguage
    );
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
  @ApiResponse({ status: 403, description: 'Access forbidden' })
  public async getAttentionDetails(
    @Param() params: any,
    @Query() query: any
  ): Promise<AttentionDetailsDto> {
    const { id } = params;
    const { collaboratorId } = query;
    // Optional: Validate collaborator access if collaboratorId is provided
    return this.attentionService.getAttentionDetails(id, collaboratorId);
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
      createdAt,
      telemedicineConfig,
    } = body;
    // Convert createdAt string to Date if provided (for historical data generation)
    // If not provided, undefined will be passed and service will use current date (backward compatible)
    const date = createdAt ? new Date(createdAt) : undefined;
    // Convert telemedicineConfig to plain object for Firestore serialization
    const plainTelemedicineConfig = telemedicineConfig
      ? JSON.parse(JSON.stringify(telemedicineConfig))
      : undefined;
    return this.attentionService.createAttention(
      queueId,
      collaboratorId,
      channel,
      user,
      type,
      block,
      date,
      undefined,
      undefined,
      servicesId,
      servicesDetails,
      clientId,
      undefined,
      undefined,
      undefined,
      plainTelemedicineConfig
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
  @ApiOperation({
    summary: 'Finish attention',
    description: 'Finishes an attention. If checkout is enabled, advances to CHECKOUT stage, otherwise terminates directly.',
  })
  @ApiParam({ name: 'id', description: 'Attention ID', example: 'attention-123' })
  @ApiResponse({ status: 200, description: 'Attention finished', type: Attention })
  @ApiResponse({ status: 404, description: 'Attention not found' })
  public async finishAttention(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Attention> {
    const { id } = params;
    const { comment, skipCheckout } = body;
    // Extract user ID from user object (user can be an object with id/userId or a string)
    const userId = typeof user === 'string' ? user : user?.id || user?.userId;
    return this.attentionService.finishAttention(userId, id, comment, undefined, skipCheckout);
  }

  @UseGuards(AuthGuard)
  @Patch('/checkout/:id/finish')
  @ApiOperation({
    summary: 'Finish checkout',
    description: 'Finishes checkout and advances attention to TERMINATED stage. Requires attention-stages-enabled and attention-checkout-enabled feature flags.',
  })
  @ApiParam({ name: 'id', description: 'Attention ID', example: 'attention-123' })
  @ApiResponse({ status: 200, description: 'Checkout finished, attention terminated', type: Attention })
  @ApiResponse({ status: 400, description: 'Checkout not enabled or attention not in CHECKOUT stage' })
  @ApiResponse({ status: 404, description: 'Attention not found' })
  public async finishCheckout(
    @User() user,
    @Param() params: any,
    @Body() body: any
  ): Promise<Attention> {
    const { id } = params;
    const { comment, collaboratorId } = body;
    // Extract user ID from user object (user can be an object with id/userId or a string)
    const userId = typeof user === 'string' ? user : user?.id || user?.userId;
    return this.attentionService.finishCheckout(userId, id, comment, collaboratorId);
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
  @Patch('/stage/:id/advance')
  @ApiOperation({
    summary: 'Advance attention stage',
    description: 'Advances an attention to a new stage (requires attention-stages-enabled feature)',
  })
  @ApiParam({ name: 'id', description: 'Attention ID', example: 'attention-123' })
  @ApiResponse({ status: 200, description: 'Stage advanced successfully', type: Attention })
  @ApiResponse({ status: 400, description: 'Feature not enabled or invalid transition' })
  @ApiResponse({ status: 404, description: 'Attention not found' })
  public async advanceStage(@User() user, @Param() params: any, @Body() body: any): Promise<Attention> {
    const { id } = params;
    const { stage, notes, collaboratorId } = body;
    // Use collaboratorId from body if provided, otherwise fallback to user (for backward compatibility)
    const collaboratorIdToUse = collaboratorId || user;
    return this.attentionService.advanceStage(user, id, stage, notes, collaboratorIdToUse);
  }

  @UseGuards(AuthGuard)
  @Get('/stage/queue/:queueId/stage/:stage')
  @ApiOperation({
    summary: 'Get attentions by stage',
    description: 'Retrieves attentions filtered by stage for a specific queue',
  })
  @ApiParam({ name: 'queueId', description: 'Queue ID', example: 'queue-123' })
  @ApiParam({ name: 'stage', description: 'Attention stage', example: 'CHECK_IN' })
  @ApiResponse({ status: 200, description: 'Attentions found', type: [Attention] })
  public async getAttentionsByStage(@Param() params: any, @Query() query: any): Promise<Attention[]> {
    const { queueId, stage } = params;
    const { commerceId, date } = query;
    const dateObj = date ? new Date(date) : undefined;
    return this.attentionService.getAttentionsByStage(commerceId, queueId, stage, dateObj);
  }

  @UseGuards(AuthGuard)
  @Patch('/track-access/:id')
  @ApiOperation({
    summary: 'Track attention access',
    description: 'Tracks that a collaborator is accessing/managing an attention (optional tracking)',
  })
  @ApiParam({ name: 'id', description: 'Attention ID', example: 'attention-123' })
  @ApiResponse({ status: 200, description: 'Access tracked', type: Attention })
  public async trackAttentionAccess(
    @User() user: string,
    @Param() params: any,
    @Body() body: any
  ): Promise<Attention> {
    const { id } = params;
    const { collaboratorId } = body;
    return this.attentionService.trackAttentionAccess(user, id, collaboratorId);
  }

  @UseGuards(AuthGuard)
  @Get('/pending/commerce/:commerceId')
  public async getPendingCommerceBookings(@Param() params: any): Promise<any> {
    const { commerceId } = params;
    return this.attentionService.getPendingCommerceAttentions(commerceId);
  }

  //@UseGuards(SimpleGuard)
  @Post('/scheduled-surveys')
  public async surveyPostAttention(@Body() body?: any): Promise<any> {
    const date = body?.date;
    return this.attentionService.surveyPostAttention(date);
  }
}
