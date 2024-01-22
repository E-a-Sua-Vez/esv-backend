import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { CollaboratorController } from './collaborator.controller';
import { Collaborator } from './collaborator.entity';
import { CollaboratorService } from './collaborator.service';
import { AdministratorModule } from 'src/administrator/administrator.module';
import { PermissionModule } from 'src/permission/permission.module';

@Module({
  imports: [
    FireormModule.forFeature([Collaborator]),
    forwardRef(() => AdministratorModule),
    forwardRef(() => PermissionModule)
  ],
  providers: [ CollaboratorService],
  exports: [CollaboratorService],
  controllers: [CollaboratorController],
})
export class CollaboratorModule {}