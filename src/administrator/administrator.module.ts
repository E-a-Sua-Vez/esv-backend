import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { PermissionModule } from '../permission/permission.module';
import { InternalMessageModule } from '../internal-message/internal-message.module';

import { AdministratorController } from './administrator.controller';
import { AdministratorService } from './administrator.service';
import { Administrator } from './model/administrator.entity';

@Module({
  imports: [
    FireormModule.forFeature([Administrator]),
    forwardRef(() => PermissionModule),
    forwardRef(() => InternalMessageModule),
  ],
  providers: [AdministratorService],
  exports: [AdministratorService],
  controllers: [AdministratorController],
})
export class AdministratorModule {}
