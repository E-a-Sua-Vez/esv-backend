import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { GcpLoggerService } from '../logger/gcp-logger.service';

@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger: GcpLoggerService;

  constructor(logger: GcpLoggerService) {
    this.logger = logger;
    this.logger.setContext('HttpExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        error = (exceptionResponse as any).error || error;
      }
    } else if (exception instanceof Error) {
      // Log full error details server-side with GCP-compatible format
      this.logger.logError(exception, request, {
        statusCode: status,
        errorType: 'UnhandledException',
      });

      // In production, don't expose error details to clients
      if (process.env.NODE_ENV === 'prod' || process.env.NODE_ENV === 'test') {
        message = 'An unexpected error occurred';
      } else {
        // In development, show more details
        message = exception.message;
      }
    } else {
      // Log unknown exception type
      this.logger.logError(new Error('Unknown exception type'), request, {
        statusCode: status,
        errorType: 'UnknownException',
        exception: String(exception),
      });
    }

    // Log the HTTP error with context (for HttpException cases)
    if (exception instanceof HttpException) {
      this.logger.logWithRequest(
        status >= 500 ? 'ERROR' : status >= 400 ? 'WARNING' : 'INFO',
        `HTTP ${status} Error: ${message}`,
        request,
        {
          statusCode: status,
          errorType: exception.constructor.name,
        }
      );
    }

    // Return sanitized error response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: Array.isArray(message) ? message : [message],
      error: process.env.NODE_ENV === 'prod' ? error : undefined, // Hide error type in production
    });
  }
}
