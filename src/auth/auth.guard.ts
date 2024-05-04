import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import * as admin from 'firebase-admin';

const { KEY } = JSON.parse(process.env.PRIVATE_KEY);
admin.initializeApp({
  credential: admin.credential.cert(
    {
      projectId: process.env.PROJECT_ID,
      privateKey: KEY,
      clientEmail: process.env.CLIENT_EMAIL
    }
  ),
});

@Injectable()
export class AuthGuard implements CanActivate {

  constructor() { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const environment = process.env.NODE_ENV;
    const validateAuth = process.env.VALIDATE_AUTH;
    if (environment !== 'local' && validateAuth === '1') {
      const request = context.switchToHttp().getRequest();
      const token = this.extractTokenFromHeader(request);
      if (!token) {
        throw new UnauthorizedException();
      }
      const decodeValue = await admin.auth().verifyIdToken(token);
      if (!decodeValue) {
        throw new UnauthorizedException();
      }
      if (decodeValue.email) {
        request['user'] = decodeValue.email;
      }
      return true;
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
