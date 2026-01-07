import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class ClientPortalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    let token: string | undefined;

    // Try to get token from Authorization header
    const authHeader = request.headers['authorization'];
    if (authHeader) {
      token = authHeader.replace('Bearer ', '');
    } else {
      // Try to get token from query params
      token = request.query.token;
    }

    if (!token) throw new UnauthorizedException('No token provided');

    try {
      const payload = jwt.verify(token, process.env.CLIENT_PORTAL_JWT_SECRET || 'client_portal_secret');
      request.clientPortal = payload;
      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
