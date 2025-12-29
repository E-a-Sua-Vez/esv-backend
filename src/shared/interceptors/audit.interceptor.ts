import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

import { AuditLogService } from '../services/audit-log.service';

/**
 * Interceptor para registrar ações de auditoria complementares ao sistema de eventos CQRS
 *
 * IMPORTANTE: O sistema de eventos CQRS já registra eventos de domínio.
 * Este interceptor registra:
 * - Ações não cobertas por eventos (ACCESS, PRINT, EXPORT, LOGIN, LOGOUT)
 * - Informações de conformidade legal (IP, user agent, compliance flags)
 * - Detalhes adicionais para auditoria legal (CFM, LGPD)
 *
 * Eventos CREATE, UPDATE, DELETE são registrados via sistema de eventos.
 * Este interceptor adiciona metadados de conformidade quando necessário.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body, params, query, ip, headers } = request;
    const user = (request as any).user;

    // Determinar ação baseada no método HTTP
    // NOTA: CREATE, UPDATE, DELETE são registrados via sistema de eventos CQRS
    // Este interceptor foca em ações de conformidade legal
    let action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'ACCESS' | 'PRINT' | 'EXPORT' | 'SIGN' = 'ACCESS';
    if (method === 'POST') {
      // Verificar se é ação de assinatura
      if (url.includes('/sign') || url.includes('/signature')) {
        action = 'SIGN';
      } else {
        action = 'CREATE'; // Será registrado também no sistema de eventos
      }
    } else if (method === 'GET') {
      // Verificar se é ação de impressão ou exportação
      if (url.includes('/print') || url.includes('/download')) {
        action = 'PRINT';
      } else if (url.includes('/export')) {
        action = 'EXPORT';
      } else {
        action = 'READ'; // Acesso a dados - importante para LGPD
      }
    } else if (method === 'PATCH' || method === 'PUT') {
      action = 'UPDATE'; // Será registrado também no sistema de eventos
    } else if (method === 'DELETE') {
      action = 'DELETE'; // Será registrado também no sistema de eventos
    }

    // Extrair informações da entidade da URL
    const entityType = this.extractEntityType(url);
    const entityId = params?.id || query?.id || body?.id;

    // Extrair mudanças se for UPDATE
    const changes = action === 'UPDATE' && body ? this.extractChanges(body) : undefined;

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: async (data) => {
          // Registrar ação bem-sucedida
          // Focar em ações de conformidade legal (ACCESS, PRINT, EXPORT, SIGN)
          // CREATE, UPDATE, DELETE são registrados via sistema de eventos CQRS
          try {
            // Registrar apenas ações específicas de conformidade ou quando necessário
            const shouldLog = action === 'ACCESS' || action === 'PRINT' || action === 'EXPORT' || action === 'SIGN' ||
                             action === 'READ' || // Acesso a dados - importante para LGPD
                             (action === 'CREATE' && entityType && ['prescription', 'exam_order', 'reference'].includes(entityType)) || // Documentos médicos
                             (action === 'UPDATE' && entityType && ['prescription', 'exam_order', 'reference'].includes(entityType)) ||
                             (action === 'DELETE' && entityType && ['prescription', 'exam_order', 'reference'].includes(entityType));

            if (shouldLog) {
              await this.auditLogService.logAction(
                user?.id || user?.userId || 'anonymous',
                action,
                entityType || 'unknown',
                entityId || 'unknown',
                {
                  userName: user?.name || user?.email,
                  userEmail: user?.email,
                  entityName: data?.name || data?.title,
                  ipAddress: ip || headers['x-forwarded-for'] as string,
                  userAgent: headers['user-agent'],
                  changes,
                  result: 'SUCCESS',
                  metadata: {
                    method,
                    url,
                    duration: Date.now() - startTime,
                    eventSystem: 'cqrs', // Indica que também foi registrado no sistema de eventos
                  },
                  complianceFlags: {
                    lgpdConsent: true, // Assumir consentimento se autenticado
                    signedDocument: action === 'SIGN',
                    dataExport: action === 'EXPORT',
                  },
                }
              );
            }
          } catch (error) {
            // Não quebrar o fluxo se houver erro no log
            console.error('Error logging audit:', error);
          }
        },
        error: async (error) => {
          // Registrar ação com falha
          try {
            await this.auditLogService.logAction(
              user?.id || user?.userId || 'anonymous',
              action,
              entityType || 'unknown',
              entityId || 'unknown',
              {
                userName: user?.name || user?.email,
                userEmail: user?.email,
                ipAddress: ip || headers['x-forwarded-for'] as string,
                userAgent: headers['user-agent'],
                changes,
                result: 'FAILURE',
                errorMessage: error.message,
                metadata: {
                  method,
                  url,
                  duration: Date.now() - startTime,
                },
              }
            );
          } catch (logError) {
            console.error('Error logging audit error:', logError);
          }
        },
      })
    );
  }

  /**
   * Extrair tipo de entidade da URL
   */
  private extractEntityType(url: string): string {
    // Exemplos: /prescription/123 -> prescription
    // /medical-exam-order/456 -> exam_order
    const match = url.match(/\/([^\/]+)\/(?:[^\/]+|$)/);
    if (match) {
      let entityType = match[1];
      // Normalizar nomes
      if (entityType === 'medical-exam-order') entityType = 'exam_order';
      if (entityType === 'medical-reference') entityType = 'reference';
      return entityType;
    }
    return 'unknown';
  }

  /**
   * Extrair mudanças do body (para UPDATE)
   */
  private extractChanges(body: any): { field: string; newValue: any }[] {
    const changes: { field: string; newValue: any }[] = [];
    for (const key in body) {
      if (body.hasOwnProperty(key) && key !== 'id') {
        changes.push({
          field: key,
          newValue: body[key],
        });
      }
    }
    return changes;
  }
}

