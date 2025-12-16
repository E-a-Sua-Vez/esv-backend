import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/user.decorator';

import { CreateTelemedicineSessionDto } from './dto/create-telemedicine-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { TelemedicineMessage, MessageSenderType } from './model/telemedicine-message.entity';
import {
  TelemedicineSession,
  TelemedicineSessionStatus,
} from './model/telemedicine-session.entity';
import { TelemedicineGateway } from './telemedicine.gateway';
import { TelemedicineService } from './telemedicine.service';

@ApiTags('Telemedicine')
@Controller('telemedicine')
export class TelemedicineController {
  constructor(
    private readonly telemedicineService: TelemedicineService,
    private readonly telemedicineGateway: TelemedicineGateway
  ) {}

  @Post('sessions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create telemedicine session' })
  @ApiResponse({ status: 201, description: 'Session created', type: TelemedicineSession })
  async createSession(
    @User() user: string,
    @Body() dto: CreateTelemedicineSessionDto
  ): Promise<TelemedicineSession> {
    return this.telemedicineService.createSession(user, dto);
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List telemedicine sessions' })
  @ApiResponse({ status: 200, description: 'List of sessions', type: [TelemedicineSession] })
  async listSessions(
    @Query('commerceId') commerceId?: string,
    @Query('clientId') clientId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('status') status?: TelemedicineSessionStatus
  ): Promise<TelemedicineSession[]> {
    return this.telemedicineService.listSessions(commerceId, clientId, doctorId, status);
  }

  @Get('sessions/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get session by ID' })
  @ApiResponse({ status: 200, description: 'Session found', type: TelemedicineSession })
  async getSession(@Param('id') id: string): Promise<TelemedicineSession> {
    return this.telemedicineService.getSessionById(id);
  }

  @Post('sessions/:id/start')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Start session' })
  @ApiResponse({ status: 200, description: 'Session started', type: TelemedicineSession })
  async startSession(@Param('id') id: string, @User() user: string): Promise<TelemedicineSession> {
    return this.telemedicineService.startSession(id, user);
  }

  @Post('sessions/:id/end')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'End session' })
  @ApiResponse({ status: 200, description: 'Session ended', type: TelemedicineSession })
  async endSession(
    @Param('id') id: string,
    @User() user: string,
    @Body() body: { notes?: string; diagnosis?: string }
  ): Promise<TelemedicineSession> {
    return this.telemedicineService.endSession(id, user, body.notes, body.diagnosis);
  }

  @Post('sessions/:id/cancel')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cancel session' })
  @ApiResponse({ status: 200, description: 'Session cancelled', type: TelemedicineSession })
  async cancelSession(@Param('id') id: string, @User() user: string): Promise<TelemedicineSession> {
    return this.telemedicineService.cancelSession(id, user);
  }

  @Post('sessions/:id/consent')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Give consent for recording' })
  @ApiResponse({ status: 200, description: 'Consent given', type: TelemedicineSession })
  async giveConsent(@Param('id') id: string, @User() user: string): Promise<TelemedicineSession> {
    return this.telemedicineService.giveConsent(id, user);
  }

  @Post('sessions/:id/recording')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Save recording URL' })
  @ApiResponse({ status: 200, description: 'Recording URL saved', type: TelemedicineSession })
  async saveRecording(
    @Param('id') id: string,
    @Body() body: { recordingUrl: string }
  ): Promise<TelemedicineSession> {
    return this.telemedicineService.saveRecordingUrl(id, body.recordingUrl);
  }

  @Get('sessions/:id/recording/upload-url')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get presigned URL for direct S3 upload (recommended)' })
  @ApiResponse({
    status: 200,
    description: 'Presigned upload URL generated',
    schema: {
      type: 'object',
      properties: {
        uploadUrl: { type: 'string', description: 'Presigned URL for PUT request' },
        recordingKey: { type: 'string', description: 'S3 key for the recording' },
        recordingUrl: { type: 'string', description: 'Final URL after upload' },
      },
    },
  })
  async getRecordingUploadUrl(
    @Param('id') id: string,
    @User() user: string,
    @Query('expiresIn') expiresIn?: number
  ): Promise<{ uploadUrl: string; recordingKey: string; recordingUrl: string }> {
    return this.telemedicineService.getRecordingUploadUrl(
      id,
      user,
      expiresIn ? parseInt(expiresIn.toString(), 10) : 3600
    );
  }

  @Post('sessions/:id/recording/save-url')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Save recording URL after direct S3 upload' })
  @ApiResponse({ status: 200, description: 'Recording URL saved', type: TelemedicineSession })
  async saveRecordingUrlFromUpload(
    @Param('id') id: string,
    @Body() body: { recordingKey: string },
    @User() user: string
  ): Promise<TelemedicineSession> {
    return this.telemedicineService.saveRecordingUrlFromPresignedUpload(
      id,
      body.recordingKey,
      user
    );
  }

  @Post('sessions/:id/recording/upload')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
    })
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload recording file to S3 (legacy - prefer upload-url endpoint)' })
  @ApiResponse({ status: 200, description: 'Recording uploaded', type: TelemedicineSession })
  async uploadRecording(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @User() user: string
  ): Promise<TelemedicineSession> {
    return this.telemedicineService.uploadRecording(id, file, user);
  }

  @Get('sessions/:id/messages')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get messages from session' })
  @ApiResponse({ status: 200, description: 'List of messages', type: [TelemedicineMessage] })
  async getMessages(@Param('id') id: string): Promise<TelemedicineMessage[]> {
    return this.telemedicineService.getMessages(id);
  }

  @Post('messages')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send message' })
  @ApiResponse({ status: 201, description: 'Message sent', type: TelemedicineMessage })
  async sendMessage(
    @User() user: string,
    @Body() dto: SendMessageDto & { senderType: 'doctor' | 'patient' }
  ): Promise<TelemedicineMessage> {
    // TODO: Determinar senderType basado en la sesión y el usuario
    // Por ahora, asumimos que viene en el DTO
    return this.telemedicineService.sendMessage(
      dto.sessionId,
      user,
      dto.senderType === 'doctor' ? MessageSenderType.DOCTOR : MessageSenderType.PATIENT,
      dto
    );
  }

  @Post('sessions/:id/messages/read')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark messages as read' })
  async markMessagesAsRead(@Param('id') id: string, @User() user: string): Promise<void> {
    return this.telemedicineService.markMessagesAsRead(id, user);
  }

  // Public endpoints (no auth required) - Rate limited for security
  @Post('sessions/:id/validate-key')
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 attempts per hour per IP
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate access key (public)' })
  @ApiResponse({ status: 200, description: 'Key validated', type: TelemedicineSession })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async validateAccessKey(
    @Param('id') id: string,
    @Body() body: { accessKey: string }
  ): Promise<TelemedicineSession> {
    return this.telemedicineService.validateAccessKey(id, body.accessKey);
  }

  @Get('sessions/:id/public')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute per IP
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Get session by ID (public, after key validation)' })
  @ApiResponse({ status: 200, description: 'Session found', type: TelemedicineSession })
  async getSessionPublic(@Param('id') id: string): Promise<TelemedicineSession> {
    return this.telemedicineService.getSessionByIdPublic(id);
  }

  // Internal endpoint for scheduler
  @Post('sessions/send-access-keys')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send access keys for upcoming sessions (scheduler)' })
  @ApiResponse({ status: 200, description: 'Access keys processed' })
  async sendAccessKeysForUpcomingSessions(): Promise<{ sent: number }> {
    const sent = await this.telemedicineService.processAccessKeysForUpcomingSessions();
    return { sent };
  }

  // Public endpoint to request access key
  @Post('sessions/:id/send-access-key')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour per IP
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send access key on demand (public)' })
  @ApiResponse({ status: 200, description: 'Access key sent', type: TelemedicineSession })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async sendAccessKeyOnDemand(@Param('id') id: string): Promise<TelemedicineSession> {
    return this.telemedicineService.sendAccessKeyOnDemand(id);
  }

  @Post('sessions/:id/patient-connected')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute per IP
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark patient as connected (public)' })
  @ApiResponse({
    status: 200,
    description: 'Patient marked as connected',
    type: TelemedicineSession,
  })
  async markPatientConnected(@Param('id') id: string): Promise<TelemedicineSession> {
    return this.telemedicineService.markPatientConnected(id);
  }

  @Post('sessions/:id/doctor-connected')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark doctor as connected' })
  @ApiResponse({
    status: 200,
    description: 'Doctor marked as connected',
    type: TelemedicineSession,
  })
  async markDoctorConnected(
    @Param('id') id: string,
    @User() user: string
  ): Promise<TelemedicineSession> {
    return this.telemedicineService.markDoctorConnected(id, user);
  }

  @Get('monitoring/stats')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get telemedicine statistics' })
  @ApiResponse({
    status: 200,
    description: 'Telemedicine statistics',
    schema: {
      type: 'object',
      properties: {
        sessions: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            active: { type: 'number' },
            scheduled: { type: 'number' },
            completed: { type: 'number' },
            cancelled: { type: 'number' },
          },
        },
      },
    },
  })
  async getStatistics(@User() user: string) {
    const stats = await this.telemedicineService.getSessionsStatistics();
    return {
      sessions: stats,
    };
  }

  @Get('monitoring/health')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get telemedicine health metrics' })
  @ApiResponse({
    status: 200,
    description: 'Telemedicine health metrics',
    schema: {
      type: 'object',
      properties: {
        activeSessions: { type: 'number' },
        connections: {
          type: 'object',
          properties: {
            active: { type: 'number' },
            max: { type: 'number' },
            activeRooms: { type: 'number' },
          },
        },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  async getHealthMetrics(@User() user: string) {
    const activeSessions = await this.telemedicineService.getActiveSessionsCount();
    const connectionStats = this.telemedicineGateway.getConnectionStatistics();
    return {
      activeSessions,
      connections: connectionStats,
      timestamp: new Date().toISOString(),
    };
  }
}
