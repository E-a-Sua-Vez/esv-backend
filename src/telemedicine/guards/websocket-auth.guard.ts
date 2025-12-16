import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import * as admin from 'firebase-admin';
import { Socket } from 'socket.io';

// Initialize Firebase Admin with error handling (lazy initialization)
let firebaseInitialized = false;
let initializationAttempted = false;

function initializeFirebase(): boolean {
  if (initializationAttempted) {
    return firebaseInitialized;
  }
  initializationAttempted = true;

  try {
    if (!process.env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }
    const { KEY } = JSON.parse(process.env.PRIVATE_KEY);

    if (!process.env.PROJECT_ID || !process.env.CLIENT_EMAIL) {
      throw new Error('PROJECT_ID and CLIENT_EMAIL environment variables are required');
    }

    // Check if already initialized
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.PROJECT_ID,
          privateKey: KEY,
          clientEmail: process.env.CLIENT_EMAIL,
        }),
      });
    }
    firebaseInitialized = true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        severity: 'ERROR',
        timestamp: new Date().toISOString(),
        message: 'Failed to initialize Firebase Admin in WebSocketAuthGuard',
        error: errorMessage,
        service: 'esv-backend',
        context: 'FirebaseInitialization',
      })
    );
    firebaseInitialized = false;
  }
  return firebaseInitialized;
}

@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  private readonly logger = new Logger(WebSocketAuthGuard.name);

  constructor() {
    // Initialize Firebase on guard creation
    initializeFirebase();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const environment = process.env.NODE_ENV;
    const validateAuth = process.env.VALIDATE_AUTH;

    // Security: Never bypass auth in production
    // Only allow bypass in local development with explicit flag
    const shouldValidateAuth = environment !== 'local' || validateAuth === '1';

    if (!shouldValidateAuth) {
      // Log auth bypass for security auditing (only in local)
      this.logger.warn(`Auth bypassed - Local development mode for socket ${client.id}`);
      return true;
    }

    // Ensure Firebase is initialized
    if (!initializeFirebase()) {
      this.logger.error(
        `Firebase Admin not initialized - authentication will fail for socket ${client.id}`
      );
      throw new WsException('Authentication service unavailable');
    }

    try {
      // Try to get token from handshake auth or headers
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (client.handshake.query?.token as string);

      if (!token) {
        this.logger.warn(
          `Unauthorized WebSocket connection attempt - No token provided: ${client.id}`
        );
        throw new WsException('Authentication token required');
      }

      // Verify Firebase token
      const decodedToken = await admin.auth().verifyIdToken(token);

      if (!decodedToken) {
        this.logger.warn(`Invalid token provided for socket ${client.id}`);
        throw new WsException('Invalid authentication token');
      }

      // Store user information in socket data for later use
      client.data.userId = decodedToken.uid;
      client.data.email = decodedToken.email;
      client.data.authenticated = true;

      this.logger.log(
        `Authenticated WebSocket connection: ${decodedToken.uid} (socket ${client.id})`
      );
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`WebSocket authentication failed for socket ${client.id}: ${errorMessage}`);
      throw new WsException('Authentication failed');
    }
  }
}
