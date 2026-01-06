import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class UniversalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader) throw new UnauthorizedException('No token provided');
    const token = authHeader.replace('Bearer ', '');

    // Intentar validar como Firebase (puedes agregar tu lógica aquí)
    // Ejemplo: if (validateFirebaseToken(token)) return true;

    // Intentar validar como client portal
    try {
      const payload = jwt.verify(token, process.env.CLIENT_PORTAL_JWT_SECRET || 'client_portal_secret');
      request.clientPortal = payload;
      return true;
    } catch {}

    throw new UnauthorizedException('Invalid token');
  }
}
