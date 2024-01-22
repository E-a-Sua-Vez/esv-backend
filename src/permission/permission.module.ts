import { forwardRef, Module } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { RolModule } from 'src/rol/rol.module';
import { BusinessModule } from '../business/business.module';
import { PlanModule } from '../plan/plan.module';
import { CommerceModule } from 'src/commerce/commerce.module';
import { PlanActivationModule } from '../plan-activation/plan-activation.module';

@Module({
  imports: [
    forwardRef(() => BusinessModule),
    forwardRef(() => CommerceModule),
    forwardRef(() => PlanModule),
    forwardRef(() => RolModule),
    forwardRef(() => PlanActivationModule)
  ],
  providers: [PermissionService],
  exports: [PermissionService],
  controllers: [],
})
export class PermissionModule {}