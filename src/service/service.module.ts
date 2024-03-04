import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { ServiceController } from './service.controller';
import { Service } from './model/service.entity';
import { ServiceService } from './service.service';

@Module({
  imports: [
    FireormModule.forFeature([Service]),
  ],
  providers: [ServiceService],
  exports: [ServiceService],
  controllers: [ServiceController],
})
export class ServiceModule {}