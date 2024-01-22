import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { RolController } from './rol.controller';
import { Rol } from './model/rol.entity';
import { RolService } from './rol.service';

@Module({
  imports: [
    FireormModule.forFeature([Rol])
  ],
  providers: [RolService],
  exports: [RolService],
  controllers: [RolController],
})
export class RolModule {}