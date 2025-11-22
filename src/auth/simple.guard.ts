import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class SimpleGuard implements CanActivate {
  constructor() {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const environment = process.env.NODE_ENV;
    const validateAuth = process.env.VALIDATE_AUTH;
    const simpleTokenAuth = process.env.SIMPLE_TOKEN_AUTH;
    if (environment !== 'local' && validateAuth === '1') {
      const request = context.switchToHttp().getRequest();
      const token = this.extractTokenFromHeader(request);
      if (!token) {
        throw new UnauthorizedException();
      }
      const decodeValue = simpleTokenAuth === token;
      if (!decodeValue) {
        throw new UnauthorizedException();
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
