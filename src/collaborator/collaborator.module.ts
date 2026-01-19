import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { AdministratorModule } from 'src/administrator/administrator.module';
import { InternalMessageModule } from 'src/internal-message/internal-message.module';
import { PermissionModule } from 'src/permission/permission.module';
import { ServiceModule } from 'src/service/service.module';
import { ProfessionalModule } from 'src/professional/professional.module';

import { CollaboratorController } from './collaborator.controller';
import { CollaboratorService } from './collaborator.service';
import { Collaborator } from './model/collaborator.entity';

@Module({
  imports: [
    FireormModule.forFeature([Collaborator]),
    forwardRef(() => AdministratorModule),
    forwardRef(() => PermissionModule),
    forwardRef(() => InternalMessageModule),
    forwardRef(() => ServiceModule),
    forwardRef(() => ProfessionalModule),
  ],
  providers: [CollaboratorService],
  exports: [CollaboratorService],
  controllers: [CollaboratorController],
})
export class CollaboratorModule {}
