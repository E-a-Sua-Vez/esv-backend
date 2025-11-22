import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { Request } from 'express';

/**
 * GCP-compatible logger service that outputs structured JSON logs
 * compatible with Google Cloud Logging
 *
 * GCP Cloud Logging expects:
 * - Structured JSON format
 * - Severity levels: DEBUG, INFO, NOTICE, WARNING, ERROR, CRITICAL, ALERT, EMERGENCY
 * - Trace context for distributed tracing
 * - Metadata in structured format
 */
@Injectable()
export class GcpLoggerService implements LoggerService {
  private context?: string;

  /**
   * Set the context for this logger instance
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Log a message with DEBUG severity
   */
  debug(message: any, ...optionalParams: any[]): void {
    this.logInternal('DEBUG', message, ...optionalParams);
  }

  /**
   * Log a message with INFO severity
   */
  log(message: any, ...optionalParams: any[]): void {
    this.logInternal('INFO', message, ...optionalParams);
  }

  /**
   * Log a message with INFO severity (alias for log)
   */
  info(message: any, ...optionalParams: any[]): void {
    this.logInternal('INFO', message, ...optionalParams);
  }

  /**
   * Log a message with WARNING severity
   */
  warn(message: any, ...optionalParams: any[]): void {
    this.logInternal('WARNING', message, ...optionalParams);
  }

  /**
   * Log a message with ERROR severity
   */
  error(message: any, trace?: string, context?: string): void {
    this.logInternal('ERROR', message, { trace, context: context || this.context });
  }

  /**
   * Log a message with CRITICAL severity
   */
  fatal(message: any, trace?: string, context?: string): void {
    this.logInternal('CRITICAL', message, { trace, context: context || this.context });
  }

  /**
   * Log a message with NOTICE severity
   */
  notice(message: any, ...optionalParams: any[]): void {
    this.logInternal('NOTICE', message, ...optionalParams);
  }

  /**
   * Log a message with VERBOSE severity
   */
  verbose(message: any, ...optionalParams: any[]): void {
    this.logInternal('DEBUG', message, ...optionalParams);
  }

  /**
   * Core logging method that formats logs for GCP Cloud Logging
   */
  private logInternal(severity: string, message: any, ...optionalParams: any[]): void {
    const timestamp = new Date().toISOString();
    const logEntry: any = {
      severity,
      timestamp,
      message: typeof message === 'string' ? message : JSON.stringify(message),
    };

    // Add context if available
    if (this.context) {
      logEntry.context = this.context;
    }

    // Parse optional parameters
    if (optionalParams.length > 0) {
      optionalParams.forEach((param, index) => {
        if (typeof param === 'object' && param !== null) {
          // Merge object parameters into log entry
          Object.assign(logEntry, param);
        } else if (typeof param === 'string') {
          // String parameters as additional context
          logEntry[`param${index}`] = param;
        } else {
          logEntry[`param${index}`] = param;
        }
      });
    }

    // Add environment information
    logEntry.environment = process.env.NODE_ENV || 'local';
    logEntry.service = 'esv-backend';

    // Output as JSON for GCP Cloud Logging
    // In local development, pretty print for readability
    if (process.env.NODE_ENV === 'local') {
      console.log(JSON.stringify(logEntry, null, 2));
    } else {
      // In production, output single-line JSON for GCP
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Create a log entry with request context
   */
  logWithRequest(
    severity: string,
    message: string,
    request: Request,
    additionalData?: Record<string, any>
  ): void {
    const logEntry: any = {
      severity,
      timestamp: new Date().toISOString(),
      message,
      context: this.context,
      environment: process.env.NODE_ENV || 'local',
      service: 'esv-backend',
      httpRequest: {
        requestMethod: request.method,
        requestUrl: request.url,
        requestSize: request.get('content-length') || '0',
        userAgent: request.get('user-agent') || '',
        remoteIp: request.ip || request.socket.remoteAddress || '',
        referer: request.get('referer') || '',
      },
    };

    // Add user information if available
    if (request['user']) {
      logEntry.user = request['user'];
    }
    if (request['userId']) {
      logEntry.userId = request['userId'];
    }

    // Add trace context if available (for GCP distributed tracing)
    const traceHeader = request.get('x-cloud-trace-context');
    if (traceHeader) {
      const [traceId] = traceHeader.split('/');
      logEntry[
        'logging.googleapis.com/trace'
      ] = `projects/${process.env.PROJECT_ID}/traces/${traceId}`;
    }

    // Merge additional data
    if (additionalData) {
      Object.assign(logEntry, additionalData);
    }

    // Output as JSON
    if (process.env.NODE_ENV === 'local') {
      console.log(JSON.stringify(logEntry, null, 2));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Log an error with full context
   */
  logError(error: Error, request?: Request, additionalData?: Record<string, any>): void {
    const logEntry: any = {
      severity: 'ERROR',
      timestamp: new Date().toISOString(),
      message: error.message,
      context: this.context,
      environment: process.env.NODE_ENV || 'local',
      service: 'esv-backend',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    };

    // Add request context if available
    if (request) {
      logEntry.httpRequest = {
        requestMethod: request.method,
        requestUrl: request.url,
        requestSize: request.get('content-length') || '0',
        userAgent: request.get('user-agent') || '',
        remoteIp: request.ip || request.socket.remoteAddress || '',
        referer: request.get('referer') || '',
      };

      if (request['user']) {
        logEntry.user = request['user'];
      }
      if (request['userId']) {
        logEntry.userId = request['userId'];
      }

      // Add trace context
      const traceHeader = request.get('x-cloud-trace-context');
      if (traceHeader) {
        const [traceId] = traceHeader.split('/');
        logEntry[
          'logging.googleapis.com/trace'
        ] = `projects/${process.env.PROJECT_ID}/traces/${traceId}`;
      }
    }

    // Merge additional data
    if (additionalData) {
      Object.assign(logEntry, additionalData);
    }

    // Output as JSON
    if (process.env.NODE_ENV === 'local') {
      console.error(JSON.stringify(logEntry, null, 2));
    } else {
      console.error(JSON.stringify(logEntry));
    }
  }
}
