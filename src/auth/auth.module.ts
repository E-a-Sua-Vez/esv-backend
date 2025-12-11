import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { AuthGuard } from './auth.guard';
import { SimpleGuard } from './simple.guard';

@Module({
  imports: [HttpModule],
  providers: [AuthGuard, SimpleGuard],
  exports: [AuthGuard, SimpleGuard],
})
export class AuthModule {}
