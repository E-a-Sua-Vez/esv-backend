import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import * as admin from 'firebase-admin';

import { GcpLoggerService } from '../shared/logger/gcp-logger.service';

// Initialize Firebase Admin with error handling
let firebaseInitialized = false;

try {
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }
  const { KEY } = JSON.parse(process.env.PRIVATE_KEY);

  if (!process.env.PROJECT_ID || !process.env.CLIENT_EMAIL) {
    throw new Error('PROJECT_ID and CLIENT_EMAIL environment variables are required');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.PROJECT_ID,
      privateKey: KEY,
      clientEmail: process.env.CLIENT_EMAIL,
    }),
  });
  firebaseInitialized = true;
} catch (error) {
  // Use console.error here as logger may not be initialized yet during bootstrap
  // This will be caught by GCP logging in production
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({
      severity: 'ERROR',
      timestamp: new Date().toISOString(),
      message: 'Failed to initialize Firebase Admin',
      error: errorMessage,
      service: 'esv-backend',
      context: 'FirebaseInitialization',
    })
  );
  // Don't throw here to allow app to start, but auth will fail
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger: GcpLoggerService;

  constructor(logger: GcpLoggerService) {
    this.logger = logger;
    this.logger.setContext('AuthGuard');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const environment = process.env.NODE_ENV;
    const validateAuth = process.env.VALIDATE_AUTH;
    const request = context.switchToHttp().getRequest();

    // Security: Never bypass auth in production
    // Only allow bypass in local development with explicit flag
    const shouldValidateAuth = environment !== 'local' || validateAuth === '1';

    if (!shouldValidateAuth) {
      // Log auth bypass for security auditing (only in local)
      this.logger.logWithRequest('WARNING', 'Auth bypassed - Local development mode', request, {
        securityEvent: 'AUTH_BYPASS',
      });
      return true;
    }

    // Ensure Firebase is initialized
    if (!firebaseInitialized) {
      this.logger.logWithRequest(
        'ERROR',
        'Firebase Admin not initialized - authentication will fail',
        request,
        {
          securityEvent: 'FIREBASE_NOT_INITIALIZED',
        }
      );
      throw new UnauthorizedException('Authentication service unavailable');
    }

    const token = this.extractTokenFromHeader(request);
    if (!token) {
      this.logger.logWithRequest(
        'WARNING',
        'Unauthorized access attempt - No token provided',
        request,
        {
          securityEvent: 'NO_TOKEN_PROVIDED',
        }
      );
      throw new UnauthorizedException('Authentication token required');
    }

    try {
      const decodeValue = await admin.auth().verifyIdToken(token);
      if (!decodeValue) {
        this.logger.logWithRequest('WARNING', 'Token verification returned null', request, {
          securityEvent: 'TOKEN_VERIFICATION_NULL',
        });
        throw new UnauthorizedException('Invalid authentication token');
      }

      // Set user information in request
      if (decodeValue.email) {
        request['user'] = decodeValue.email;
        request['userId'] = decodeValue.uid;
      }

      return true;
    } catch (error) {
      // Log authentication failures for security monitoring
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logWithRequest('WARNING', `Authentication failed: ${errorMessage}`, request, {
        securityEvent: 'AUTH_FAILED',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      });
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
