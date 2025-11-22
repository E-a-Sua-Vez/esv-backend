import { Module as ModuleDecorador } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { ModuleController } from './module.controller';
import { Module } from './module.entity';
import { ModuleService } from './module.service';

@ModuleDecorador({
  imports: [FireormModule.forFeature([Module])],
  providers: [ModuleService],
  exports: [ModuleService],
  controllers: [ModuleController],
})
export class ModuleModule {}
