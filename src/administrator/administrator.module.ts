import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { AdministratorController } from './administrator.controller';
import { Administrator } from './model/administrator.entity';
import { AdministratorService } from './administrator.service';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [
    FireormModule.forFeature([Administrator]),
    forwardRef(() => PermissionModule),
  ],
  providers: [AdministratorService],
  exports: [AdministratorService],
  controllers: [AdministratorController],
})
export class AdministratorModule {}