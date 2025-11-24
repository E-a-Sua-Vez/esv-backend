import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';

/**
 * Security Logger Service
 * Logs security-related events for monitoring and auditing
 */
@Injectable()
export class SecurityLoggerService {
  private readonly logger = new Logger(SecurityLoggerService.name);

  /**
   * Log authentication failure
   */
  logAuthFailure(request: Request, reason: string, metadata?: Record<string, unknown>): void {
    this.logger.warn('Authentication failure', {
      securityEvent: 'AUTH_FAILURE',
      ip: this.getClientIp(request),
      path: request.path,
      method: request.method,
      reason,
      userAgent: request.get('user-agent'),
      ...metadata,
    });
  }

  /**
   * Log authentication success
   */
  logAuthSuccess(request: Request, userId: string, metadata?: Record<string, unknown>): void {
    this.logger.log('Authentication success', {
      securityEvent: 'AUTH_SUCCESS',
      ip: this.getClientIp(request),
      path: request.path,
      method: request.method,
      userId,
      ...metadata,
    });
  }

  /**
   * Log rate limit exceeded
   */
  logRateLimitExceeded(request: Request, metadata?: Record<string, unknown>): void {
    this.logger.warn('Rate limit exceeded', {
      securityEvent: 'RATE_LIMIT_EXCEEDED',
      ip: this.getClientIp(request),
      path: request.path,
      method: request.method,
      userAgent: request.get('user-agent'),
      ...metadata,
    });
  }

  /**
   * Log CORS violation
   */
  logCorsViolation(request: Request, origin: string, metadata?: Record<string, unknown>): void {
    this.logger.warn('CORS violation', {
      securityEvent: 'CORS_VIOLATION',
      ip: this.getClientIp(request),
      origin,
      path: request.path,
      method: request.method,
      ...metadata,
    });
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(
    request: Request,
    activity: string,
    metadata?: Record<string, unknown>
  ): void {
    this.logger.warn('Suspicious activity detected', {
      securityEvent: 'SUSPICIOUS_ACTIVITY',
      ip: this.getClientIp(request),
      path: request.path,
      method: request.method,
      activity,
      userAgent: request.get('user-agent'),
      ...metadata,
    });
  }

  /**
   * Log input validation failure
   */
  logValidationFailure(
    request: Request,
    field: string,
    value: unknown,
    metadata?: Record<string, unknown>
  ): void {
    this.logger.warn('Input validation failure', {
      securityEvent: 'VALIDATION_FAILURE',
      ip: this.getClientIp(request),
      path: request.path,
      method: request.method,
      field,
      valueType: typeof value,
      ...metadata,
    });
  }

  /**
   * Get client IP address
   */
  private getClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (request.headers['x-real-ip'] as string) ||
      request.ip ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }
}
