import { HttpService } from '@nestjs/axios';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SimpleGuard implements CanActivate {
  constructor(@Optional() private readonly httpService?: HttpService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const environment = process.env.NODE_ENV;
    const validateAuth = process.env.VALIDATE_AUTH;
    const simpleTokenAuth = process.env.SIMPLE_TOKEN_AUTH;

    if (environment !== 'local' && validateAuth === '1') {
      const request = context.switchToHttp().getRequest();
      const token = this.extractTokenFromHeader(request);
      if (!token) {
        throw new UnauthorizedException('Authentication token required');
      }

      // Check if token is a JWT (OIDC token from Cloud Scheduler)
      if (this.isJWT(token) && this.httpService) {
        // Verify OIDC token from Google Cloud Scheduler
        const isValidOIDC = await this.verifyOIDCToken(token, request);
        if (isValidOIDC) {
          return true;
        }
        // If OIDC verification fails, fall through to simple token check
      }

      // Fall back to simple token authentication
      if (simpleTokenAuth && simpleTokenAuth === token) {
        return true;
      }

      throw new UnauthorizedException('Invalid authentication token');
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private isJWT(token: string): boolean {
    // JWT tokens have 3 parts separated by dots: header.payload.signature
    const parts = token.split('.');
    return parts.length === 3 && parts[0].startsWith('eyJ');
  }

  private async verifyOIDCToken(token: string, request: Request): Promise<boolean> {
    try {
      // Verify OIDC token using Google's tokeninfo endpoint
      const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`;
      const response = await firstValueFrom(this.httpService.get(tokenInfoUrl));

      if (response.status === 200 && response.data) {
        const tokenInfo = response.data;
        const targetUrl = request.protocol + '://' + request.get('host') + request.originalUrl;
        const baseUrl = request.protocol + '://' + request.get('host');

        // Verify the token is issued by Google
        const validIssuers = [
          'https://accounts.google.com',
          'accounts.google.com',
          'https://cloud.google.com',
        ];
        if (!validIssuers.includes(tokenInfo.iss)) {
          return false;
        }

        // Verify the audience matches (for Cloud Scheduler, aud should match the target URL)
        // Cloud Scheduler sets aud to the target URL
        if (tokenInfo.aud) {
          // Normalize URLs (remove trailing slashes for comparison)
          const normalizedAud = tokenInfo.aud.replace(/\/$/, '');
          const normalizedTarget = targetUrl.replace(/\/$/, '');
          const normalizedBase = baseUrl.replace(/\/$/, '');

          // Audience should match target URL or base URL
          // Also allow service account emails (for service-to-service auth)
          const isServiceAccountEmail =
            tokenInfo.aud.includes('@') && tokenInfo.aud.endsWith('.iam.gserviceaccount.com');
          const matchesTarget = normalizedAud === normalizedTarget;
          const matchesBase = normalizedAud === normalizedBase;

          if (!matchesTarget && !matchesBase && !isServiceAccountEmail) {
            return false;
          }
        }

        // Verify token is not expired
        if (tokenInfo.exp) {
          const expirationTime = parseInt(tokenInfo.exp, 10) * 1000; // Convert to milliseconds
          if (Date.now() >= expirationTime) {
            return false;
          }
        }

        return true;
      }
      return false;
    } catch (error) {
      // If tokeninfo verification fails, return false to fall back to simple token
      return false;
    }
  }
}
