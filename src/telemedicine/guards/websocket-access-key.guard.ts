import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

import { TelemedicineService } from '../telemedicine.service';

@Injectable()
export class WebSocketAccessKeyGuard implements CanActivate {
  private readonly logger = new Logger(WebSocketAccessKeyGuard.name);

  constructor(private readonly telemedicineService: TelemedicineService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const environment = process.env.NODE_ENV;
    const validateAuth = process.env.VALIDATE_AUTH;

    // Security: Never bypass auth in production
    const shouldValidateAuth = environment !== 'local' || validateAuth === '1';

    if (!shouldValidateAuth) {
      this.logger.warn(`Access key auth bypassed - Local development mode for socket ${client.id}`);
      return true;
    }

    try {
      // Get access key and session ID from handshake
      const accessKey = client.handshake.auth?.accessKey as string;
      const sessionId = client.handshake.auth?.sessionId as string;

      if (!accessKey || !sessionId) {
        this.logger.warn(
          `Unauthorized WebSocket connection attempt - Missing access key or session ID: ${client.id}`
        );
        throw new WsException('Access key and session ID required');
      }

      // Validate access key
      const session = await this.telemedicineService.validateAccessKey(sessionId, accessKey);

      // Store session information in socket data
      client.data.sessionId = sessionId;
      client.data.isPublicPatient = true;
      client.data.userId = session.clientId;
      client.data.authenticated = true;

      this.logger.log(
        `Authenticated WebSocket connection with access key: session ${sessionId} (socket ${client.id})`
      );
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `WebSocket access key authentication failed for socket ${client.id}: ${errorMessage}`
      );
      throw new WsException('Access key validation failed');
    }
  }
}




















