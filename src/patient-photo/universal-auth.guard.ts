import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin with error handling (lazy initialization)
let firebaseInitialized = false;
let initializationAttempted = false;

function initializeFirebase() {
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
    firebaseInitialized = false;
  }
  return firebaseInitialized;
}

@Injectable()
export class UniversalAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader) throw new UnauthorizedException('No token provided');
    const token = authHeader.replace('Bearer ', '');

    // Try Firebase validation first
    if (initializeFirebase()) {
      try {
        const decodeValue = await admin.auth().verifyIdToken(token);
        if (decodeValue) {
          // Set user information for Firebase users
          if (decodeValue.email) {
            request['user'] = {
              email: decodeValue.email,
              id: decodeValue.uid,
              userId: decodeValue.uid,
            };
            request['userId'] = decodeValue.uid;
          }
          return true;
        }
      } catch (firebaseError) {
        // Firebase validation failed, continue to client portal
      }
    }

    // Try client portal JWT validation
    try {
      const payload = jwt.verify(token, process.env.CLIENT_PORTAL_JWT_SECRET || 'client_portal_secret');
      request.clientPortal = payload;
      return true;
    } catch (jwtError) {
      // Both validations failed
    }

    throw new UnauthorizedException('Invalid token');
  }
}
