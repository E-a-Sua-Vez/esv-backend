import { Global, Module } from '@nestjs/common';

import { GcpLoggerService } from './gcp-logger.service';

/**
 * Global logger module that provides GCP-compatible logging
 * throughout the application
 */
@Global()
@Module({
  providers: [GcpLoggerService],
  exports: [GcpLoggerService],
})
export class LoggerModule {}
