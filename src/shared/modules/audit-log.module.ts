import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { AuditLog } from '../model/audit-log.entity';
import { AuditLogService } from '../services/audit-log.service';
import { AuditLogController } from '../controllers/audit-log.controller';
import { AuditInterceptor } from '../interceptors/audit.interceptor';

@Module({
  imports: [FireormModule.forFeature([AuditLog])],
  providers: [AuditLogService, AuditInterceptor],
  controllers: [AuditLogController],
  exports: [AuditLogService, AuditInterceptor],
})
export class AuditLogModule {}

