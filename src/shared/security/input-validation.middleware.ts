import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { SecurityLoggerService } from './security-logger.service';

/**
 * Input Validation Middleware
 * Validates and sanitizes request inputs to prevent injection attacks
 */
@Injectable()
export class InputValidationMiddleware implements NestMiddleware {
  constructor(private readonly securityLogger: SecurityLoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Validate request body
    if (req.body && typeof req.body === 'object') {
      this.validateObject(req.body, req);
    }

    // Validate query parameters
    if (req.query && typeof req.query === 'object') {
      this.validateObject(req.query, req);
    }

    // Validate route parameters
    if (req.params && typeof req.params === 'object') {
      this.validateObject(req.params, req);
    }

    next();
  }

  private validateObject(obj: Record<string, unknown>, req: Request, depth = 0): void {
    // Prevent deep nesting attacks
    if (depth > 10) {
      this.securityLogger.logSuspiciousActivity(req, 'Deep nesting detected', {
        depth,
        path: req.path,
      });
      throw new BadRequestException('Request structure too deep');
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];

        // Check for dangerous patterns in keys
        if (this.isDangerousKey(key)) {
          this.securityLogger.logValidationFailure(req, key, value, {
            reason: 'Dangerous key pattern',
          });
          throw new BadRequestException(`Invalid parameter name: ${key}`);
        }

        // Validate string values
        if (typeof value === 'string') {
          if (this.containsDangerousContent(value)) {
            this.securityLogger.logValidationFailure(req, key, '***REDACTED***', {
              reason: 'Dangerous content detected',
            });
            throw new BadRequestException(`Invalid content in field: ${key}`);
          }

          // Check for extremely long strings (potential DoS)
          if (value.length > 10000) {
            this.securityLogger.logSuspiciousActivity(req, 'Extremely long string detected', {
              field: key,
              length: value.length,
            });
            throw new BadRequestException(`Field ${key} exceeds maximum length`);
          }
        }

        // Recursively validate nested objects
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          this.validateObject(value as Record<string, unknown>, req, depth + 1);
        }

        // Validate arrays
        if (Array.isArray(value)) {
          if (value.length > 1000) {
            this.securityLogger.logSuspiciousActivity(req, 'Extremely large array detected', {
              field: key,
              length: value.length,
            });
            throw new BadRequestException(`Array ${key} exceeds maximum size`);
          }
          value.forEach((item, index) => {
            if (item && typeof item === 'object') {
              this.validateObject(item as Record<string, unknown>, req, depth + 1);
            }
          });
        }
      }
    }
  }

  private isDangerousKey(key: string): boolean {
    const dangerousPatterns = [
      /^__proto__$/i,
      /^constructor$/i,
      /^prototype$/i,
      /\.\./, // Path traversal
      /[<>]/g, // HTML tags
    ];

    return dangerousPatterns.some(pattern => pattern.test(key));
  }

  private containsDangerousContent(value: string): boolean {
    const dangerousPatterns = [
      /<script/gi,
      /javascript:/gi,
      /on\w+\s*=/gi, // Event handlers
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
      /data:text\/html/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi,
    ];

    return dangerousPatterns.some(pattern => pattern.test(value));
  }
}
