import { Logger, UseGuards, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import { Server, Socket } from 'socket.io';

import { WebSocketAccessKeyGuard } from './guards/websocket-access-key.guard';
import { WebSocketAuthGuard } from './guards/websocket-auth.guard';
import { MessageSenderType } from './model/telemedicine-message.entity';
import { TelemedicineService } from './telemedicine.service';

// Get allowed origins from environment or default
const getAllowedOrigins = (): string[] => {
  const origins = process.env.WEBSOCKET_ALLOWED_ORIGINS;
  if (origins) {
    return origins.split(',').map(origin => origin.trim());
  }
  // Default origins based on environment
  if (process.env.NODE_ENV === 'production') {
    return ['https://yourdomain.com', 'https://www.yourdomain.com'];
  }
  // Development: allow localhost and common dev ports
  return [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8080',
  ];
};

@WebSocketGateway({
  cors: {
    origin: getAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST'],
  },
  namespace: '/telemedicine',
})
export class TelemedicineGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TelemedicineGateway.name);
  private readonly activeRooms = new Map<string, Set<string>>(); // roomId -> Set of socketIds
  private readonly socketUserMap = new Map<string, { userId: string; userType: string }>(); // socketId -> { userId, userType }
  private readonly roomToSessionMap = new Map<string, string>(); // roomId -> sessionId (for state persistence)
  private readonly maxConnectionsPerInstance = parseInt(
    process.env.MAX_WEBSOCKET_CONNECTIONS || '500',
    10
  );
  private readonly currentConnections = new Set<string>(); // Track all active socket IDs
  private cleanupInterval: NodeJS.Timeout | null = null;
  private redisPubClient: RedisClientType | null = null;
  private redisSubClient: RedisClientType | null = null;
  private redisEnabled = false;

  constructor(
    private readonly telemedicineService: TelemedicineService,
    private readonly wsAuthGuard: WebSocketAuthGuard,
    private readonly wsAccessKeyGuard: WebSocketAccessKeyGuard
  ) {
    // Don't start cleanup here - wait for onModuleInit when server is ready
  }

  /**
   * Initialize gateway - setup Redis adapter if enabled, sync room state from database on startup
   */
  async onModuleInit(): Promise<void> {
    // Try to initialize Redis adapter if enabled
    await this.initializeRedisAdapter();

    // Sync room state from database on startup
    this.logger.log('Initializing telemedicine gateway - syncing room state from database');
    try {
      // Get active sessions with room state from database
      const activeSessions = await this.telemedicineService.getActiveSessionsWithRoomState();

      // Rebuild in-memory state from database (for state recovery after restart)
      for (const session of activeSessions) {
        if (session.connectedUsers && session.connectedUsers.length > 0) {
          // Store room mapping (we don't know which sockets are active, so we only store the mapping)
          this.roomToSessionMap.set(session.roomId, session.id);

          // Note: We can't rebuild activeRooms and socketUserMap because we don't know
          // which sockets are currently connected. The actual connections will be
          // re-established when clients reconnect, and the state will be updated then.
          this.logger.debug(
            `Synced room state for session ${session.id} (roomId: ${session.roomId})`
          );
        }
      }

      this.logger.log(
        `Gateway initialized - synced ${activeSessions.length} active sessions with room state`
      );
    } catch (error) {
      this.logger.error(`Error initializing gateway state sync: ${error.message}`, error.stack);
      // Continue anyway - state will be rebuilt as users connect
    }

    // Set gateway reference in service to avoid circular dependency
    this.telemedicineService.setGateway(this);

    // Start periodic cleanup of inactive rooms after server is initialized
    this.startRoomCleanup();
  }

  /**
   * Initialize Redis adapter for Socket.IO if Redis is enabled
   * Gracefully falls back to in-memory adapter if Redis is disabled or unavailable
   */
  private async initializeRedisAdapter(): Promise<void> {
    const redisEnabled = process.env.REDIS_ENABLED === 'true';

    if (!redisEnabled) {
      this.logger.log('Redis adapter disabled - using in-memory adapter (single instance only)');
      this.redisEnabled = false;
      return;
    }

    const redisHost = process.env.REDIS_HOST;
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD || undefined;
    const redisDb = parseInt(process.env.REDIS_DB || '0', 10);
    const useTls = process.env.REDIS_TLS === 'true';

    if (!redisHost) {
      this.logger.warn(
        'REDIS_ENABLED is true but REDIS_HOST is not configured - falling back to in-memory adapter'
      );
      this.redisEnabled = false;
      return;
    }

    try {
      // Create Redis clients
      const redisUrl = `${useTls ? 'rediss' : 'redis'}://${
        redisPassword ? `:${redisPassword}@` : ''
      }${redisHost}:${redisPort}/${redisDb}`;

      this.redisPubClient = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: retries => {
            if (retries > 10) {
              this.logger.error(
                'Redis connection failed after 10 retries - falling back to in-memory adapter'
              );
              this.redisEnabled = false;
              return new Error('Redis connection failed');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.redisSubClient = this.redisPubClient.duplicate();

      // Handle connection errors gracefully
      this.redisPubClient.on('error', err => {
        this.logger.error(`Redis pub client error: ${err.message}`);
        this.redisEnabled = false;
      });

      this.redisSubClient.on('error', err => {
        this.logger.error(`Redis sub client error: ${err.message}`);
        this.redisEnabled = false;
      });

      // Connect clients
      await Promise.all([this.redisPubClient.connect(), this.redisSubClient.connect()]);

      // Set Redis adapter on Socket.IO server
      this.server.adapter(createAdapter(this.redisPubClient, this.redisSubClient));
      this.redisEnabled = true;

      this.logger.log(
        `Redis adapter enabled - horizontal scaling active (host: ${redisHost}:${redisPort})`
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize Redis adapter: ${error.message} - falling back to in-memory adapter`,
        error.stack
      );
      this.redisEnabled = false;

      // Clean up failed connections
      if (this.redisPubClient) {
        try {
          await this.redisPubClient.quit();
        } catch (e) {
          // Ignore cleanup errors
        }
        this.redisPubClient = null;
      }
      if (this.redisSubClient) {
        try {
          await this.redisSubClient.quit();
        } catch (e) {
          // Ignore cleanup errors
        }
        this.redisSubClient = null;
      }

      // Continue with in-memory adapter (graceful degradation)
      this.logger.warn(
        'Using in-memory adapter - WebSocket connections will only work within a single instance'
      );
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clean up Redis connections
    if (this.redisPubClient) {
      try {
        await this.redisPubClient.quit();
        this.redisPubClient = null;
      } catch (error) {
        this.logger.error(`Error closing Redis pub client: ${error.message}`);
      }
    }

    if (this.redisSubClient) {
      try {
        await this.redisSubClient.quit();
        this.redisSubClient = null;
      } catch (error) {
        this.logger.error(`Error closing Redis sub client: ${error.message}`);
      }
    }
  }

  /**
   * Start periodic cleanup of inactive rooms to prevent memory leaks
   */
  private startRoomCleanup(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveRooms();
    }, 5 * 60 * 1000);
  }

  /**
   * Cleanup inactive rooms (rooms with no active connections)
   */
  private cleanupInactiveRooms(): void {
    // Check if server is initialized
    if (!this.server || !this.server.sockets || !this.server.sockets.sockets) {
      this.logger.warn('Cannot cleanup inactive rooms: server not fully initialized');
      return;
    }

    const beforeCleanup = this.activeRooms.size;
    let cleaned = 0;

    this.activeRooms.forEach((clients, roomId) => {
      // Remove any stale socket IDs (sockets that no longer exist)
      const validClients = Array.from(clients).filter(socketId => {
        try {
          const socket = this.server.sockets.sockets.get(socketId);
          if (!socket || !socket.connected) {
            clients.delete(socketId);
            this.socketUserMap.delete(socketId);
            return false;
          }
          return true;
        } catch (error) {
          // If socket lookup fails, remove it from our tracking
          this.logger.warn(`Error checking socket ${socketId}: ${error.message}`);
          clients.delete(socketId);
          this.socketUserMap.delete(socketId);
          return false;
        }
      });

      // If room has no valid clients, remove it
      if (validClients.length === 0) {
        this.activeRooms.delete(roomId);
        cleaned++;
      }
    });

    if (cleaned > 0 || beforeCleanup !== this.activeRooms.size) {
      this.logger.log(
        `Room cleanup: Removed ${cleaned} inactive rooms. Active rooms: ${this.activeRooms.size}`
      );
    }
  }

  /**
   * Persist room connection state to database
   * Extracts connected users from in-memory state and saves to database
   */
  private async persistRoomStateToDatabase(sessionId: string, roomId: string): Promise<void> {
    try {
      const roomClients = this.activeRooms.get(roomId);
      if (!roomClients || roomClients.size === 0) {
        // Room is empty, clear state
        await this.telemedicineService.clearRoomConnectionState(sessionId);
        return;
      }

      // Extract connected user IDs from socket map
      const connectedUsers: string[] = [];
      let connectedDoctorId: string | undefined;
      let connectedPatientId: string | undefined;

      roomClients.forEach(socketId => {
        const userInfo = this.socketUserMap.get(socketId);
        if (userInfo) {
          if (!connectedUsers.includes(userInfo.userId)) {
            connectedUsers.push(userInfo.userId);
          }
          if (userInfo.userType === 'doctor') {
            connectedDoctorId = userInfo.userId;
          } else if (userInfo.userType === 'patient') {
            connectedPatientId = userInfo.userId;
          }
        }
      });

      // Persist to database
      await this.telemedicineService.updateRoomConnectionState(
        sessionId,
        connectedUsers,
        connectedDoctorId,
        connectedPatientId
      );
    } catch (error) {
      // Non-critical, log but don't fail
      this.logger.debug(
        `Could not persist room state to database for session ${sessionId}: ${error.message}`
      );
    }
  }

  /**
   * Check if we can accept more connections
   */
  private canAcceptConnection(): boolean {
    const currentCount = this.currentConnections.size;
    if (currentCount >= this.maxConnectionsPerInstance) {
      this.logger.warn(
        `Max connections reached: ${currentCount}/${this.maxConnectionsPerInstance}. Rejecting new connection.`
      );
      return false;
    }
    return true;
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connection attempt: ${client.id}`);

    // Check connection limit
    if (!this.canAcceptConnection()) {
      client.emit('error', { message: 'Server at capacity. Please try again later.' });
      client.disconnect();
      return;
    }

    // Check if client is using access key (public patient) or Firebase auth (doctor/authenticated)
    const hasAccessKey = client.handshake.auth?.accessKey && client.handshake.auth?.sessionId;
    const hasToken = client.handshake.auth?.token || client.handshake.headers?.authorization;

    try {
      if (hasAccessKey) {
        // Use access key authentication for public patients
        const context = { switchToWs: () => ({ getClient: () => client }) };
        const isValid = await this.wsAccessKeyGuard.canActivate(context as any);
        if (!isValid) {
          client.disconnect();
          return;
        }
        this.logger.log(
          `Patient connected via access key: ${client.data.sessionId} (socket ${client.id})`
        );
      } else if (hasToken) {
        // Use Firebase authentication for doctors and authenticated users
        const context = { switchToWs: () => ({ getClient: () => client }) };
        const isValid = await this.wsAuthGuard.canActivate(context as any);
        if (!isValid) {
          client.disconnect();
          return;
        }
        this.logger.log(
          `Authenticated user connected: ${client.data.userId} (socket ${client.id})`
        );
      } else {
        // No authentication provided - disconnect
        this.logger.warn(
          `Unauthorized WebSocket connection attempt - No auth provided: ${client.id}`
        );
        client.disconnect();
        return;
      }

      // Track successful connection
      this.currentConnections.add(client.id);
      this.logger.log(
        `Connection accepted. Total connections: ${this.currentConnections.size}/${this.maxConnectionsPerInstance}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`WebSocket authentication failed for ${client.id}: ${errorMessage}`);
      client.disconnect();
      return;
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Remove from connection tracking
    this.currentConnections.delete(client.id);

    // Remover mapeo de socket a usuario
    this.socketUserMap.delete(client.id);

    // Remover cliente de todas las salas y persistir estado
    this.activeRooms.forEach(async (clients, roomId) => {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        client.to(roomId).emit('user-left', { socketId: client.id });

        // Persist updated state to database
        const sessionId = this.roomToSessionMap.get(roomId);
        if (sessionId) {
          await this.persistRoomStateToDatabase(sessionId, roomId);
        }

        if (clients.size === 0) {
          this.activeRooms.delete(roomId);
          this.roomToSessionMap.delete(roomId);
          if (sessionId) {
            await this.telemedicineService.clearRoomConnectionState(sessionId);
          }
        }
      }
    });

    this.logger.log(
      `Connection removed. Total connections: ${this.currentConnections.size}/${this.maxConnectionsPerInstance}`
    );
  }

  /**
   * Unirse a una sala de teleconsulta
   */
  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @MessageBody()
    data: { sessionId: string; roomId: string; userId: string; userType: 'doctor' | 'patient' },
    @ConnectedSocket() client: Socket
  ) {
    try {
      const { sessionId, roomId, userId, userType } = data;

      // Verificar que la sesión existe
      const session = await this.telemedicineService.getSessionById(sessionId);

      // Verificar permisos
      if (userType === 'doctor' && session.doctorId !== userId) {
        client.emit('error', { message: 'Unauthorized' });
        return;
      }

      if (userType === 'patient' && session.clientId !== userId) {
        client.emit('error', { message: 'Unauthorized' });
        return;
      }

      // Unirse a la sala
      await client.join(roomId);

      // Registrar en activeRooms
      if (!this.activeRooms.has(roomId)) {
        this.activeRooms.set(roomId, new Set());
      }
      this.activeRooms.get(roomId)!.add(client.id);

      // Guardar mapeo de socket a usuario
      this.socketUserMap.set(client.id, { userId, userType });

      // Store roomId -> sessionId mapping for state persistence
      this.roomToSessionMap.set(roomId, sessionId);

      // Persist room connection state to database
      await this.persistRoomStateToDatabase(sessionId, roomId);

      // Notificar a otros en la sala
      client.to(roomId).emit('user-joined', {
        socketId: client.id,
        userId,
        userType,
      });

      // Si es la primera persona, iniciar sesión automáticamente
      if (this.activeRooms.get(roomId)!.size === 1 && session.status === 'scheduled') {
        await this.telemedicineService.startSession(sessionId, userId);
      }

      // Update session activity when joining
      try {
        await this.telemedicineService.updateSessionActivity(sessionId);
      } catch (error) {
        // Non-critical, log but don't fail
        this.logger.debug(`Could not update activity for session ${sessionId}: ${error.message}`);
      }

      this.logger.log(`User ${userId} joined room ${roomId}`);
    } catch (error) {
      this.logger.error(`Error joining room: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  /**
   * Salir de una sala
   */
  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId } = data;
    await client.leave(roomId);

    if (this.activeRooms.has(roomId)) {
      this.activeRooms.get(roomId)!.delete(client.id);
      client.to(roomId).emit('user-left', { socketId: client.id });

      // Emit connection status update
      client.to(roomId).emit('connection-status-update', {
        userId: client.id,
        connected: false,
        timestamp: new Date(),
      });

      if (this.activeRooms.get(roomId)!.size === 0) {
        this.activeRooms.delete(roomId);
      }
    }

    this.logger.log(`Client ${client.id} left room ${roomId}`);
  }

  /**
   * Notificar a todos los clientes en una sala que la sesión ha finalizado
   */
  notifySessionCompleted(roomId: string, sessionId: string): void {
    try {
      if (!this.server || !this.server.sockets) {
        this.logger.warn('Cannot notify session completion: server not initialized');
        return;
      }

      // Emitir evento a todos los clientes en la sala
      this.server.to(roomId).emit('session-completed', {
        sessionId,
        roomId,
        timestamp: new Date(),
        message: 'La sesión de teleconsulta ha finalizado',
      });

      this.logger.log(`Notified room ${roomId} that session ${sessionId} has completed`);
    } catch (error) {
      this.logger.error(`Error notifying session completion: ${error.message}`, error.stack);
    }
  }

  /**
   * Enviar mensaje de chat
   */
  @SubscribeMessage('send-message')
  async handleSendMessage(
    @MessageBody()
    data: {
      sessionId: string;
      senderId: string;
      senderType: 'doctor' | 'patient';
      message: string;
    },
    @ConnectedSocket() client: Socket
  ) {
    try {
      const { sessionId, senderId, senderType, message } = data;

      // Validate message length
      if (!message || message.trim().length === 0) {
        client.emit('error', { message: 'Message cannot be empty' });
        return;
      }

      if (message.length > 10000) {
        client.emit('error', { message: 'Message too long. Maximum 10000 characters allowed.' });
        return;
      }

      // Sanitize message (remove leading/trailing whitespace)
      const sanitizedMessage = message.trim();

      const savedMessage = await this.telemedicineService.sendMessage(
        sessionId,
        senderId,
        senderType === 'doctor' ? MessageSenderType.DOCTOR : MessageSenderType.PATIENT,
        {
          sessionId,
          message: sanitizedMessage,
        }
      );

      // Enviar mensaje a todos en la sala
      const session = await this.telemedicineService.getSessionById(sessionId);
      this.server.to(session.roomId).emit('new-message', {
        id: savedMessage.id,
        sessionId: savedMessage.sessionId,
        senderId: savedMessage.senderId,
        senderType: savedMessage.senderType,
        message: savedMessage.message,
        timestamp: savedMessage.timestamp,
        attachments: savedMessage.attachments,
      });

      this.logger.log(`Message sent in session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  /**
   * Señalización WebRTC - Oferta de video
   */
  @SubscribeMessage('video-offer')
  async handleVideoOffer(
    @MessageBody() data: { roomId: string; offer: any },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, offer } = data;
    const userInfo = this.socketUserMap.get(client.id);
    client.to(roomId).emit('video-offer', {
      offer,
      from: userInfo?.userId || client.id,
      socketId: client.id,
    });
  }

  /**
   * Señalización WebRTC - Respuesta de video
   */
  @SubscribeMessage('video-answer')
  async handleVideoAnswer(
    @MessageBody() data: { roomId: string; answer: any },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, answer } = data;
    const userInfo = this.socketUserMap.get(client.id);
    client.to(roomId).emit('video-answer', {
      answer,
      from: userInfo?.userId || client.id,
      socketId: client.id,
    });
  }

  /**
   * Señalización WebRTC - ICE Candidate
   */
  @SubscribeMessage('ice-candidate')
  async handleIceCandidate(
    @MessageBody() data: { roomId: string; candidate: any },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, candidate } = data;
    const userInfo = this.socketUserMap.get(client.id);
    client.to(roomId).emit('ice-candidate', {
      candidate,
      from: userInfo?.userId || client.id,
      socketId: client.id,
    });
  }

  /**
   * Compartir pantalla
   */
  @SubscribeMessage('screen-share-start')
  async handleScreenShareStart(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId } = data;
    client.to(roomId).emit('screen-share-start', {
      from: client.id,
    });
  }

  @SubscribeMessage('screen-share-stop')
  async handleScreenShareStop(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId } = data;
    client.to(roomId).emit('screen-share-stop', {
      from: client.id,
    });
  }

  /**
   * Get connection statistics (for monitoring)
   */
  getConnectionStatistics(): {
    activeConnections: number;
    maxConnections: number;
    activeRooms: number;
    redisEnabled: boolean;
  } {
    return {
      activeConnections: this.currentConnections.size,
      maxConnections: this.maxConnectionsPerInstance,
      activeRooms: this.activeRooms.size,
      redisEnabled: this.redisEnabled,
    };
  }
}
