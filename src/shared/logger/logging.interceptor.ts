import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import { GcpLoggerService } from './gcp-logger.service';

/**
 * Logging interceptor that logs all HTTP requests and responses
 * with GCP-compatible structured logging
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: GcpLoggerService) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, body, query, params } = request;
    const startTime = Date.now();

    // Log incoming request
    this.logger.logWithRequest('INFO', `Incoming ${method} ${url}`, request, {
      requestBody: this.sanitizeRequestBody(body),
      queryParams: query,
      routeParams: params,
    });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const { statusCode } = response;

        // Log successful response
        this.logger.logWithRequest('INFO', `Outgoing ${method} ${url} - ${statusCode}`, request, {
          statusCode,
          duration: `${duration}ms`,
        });
      }),
      catchError(error => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Log error response
        this.logger.logError(error, request, {
          statusCode,
          duration: `${duration}ms`,
        });

        return throwError(() => error);
      })
    );
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  private sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'authorization', 'secret', 'key'];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}
