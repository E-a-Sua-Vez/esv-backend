import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { FormController } from './form.controller';
import { Form } from './model/form.entity';
import { FormService } from './form.service';
import { ClientModule } from '../client/client.module';

@Module({
  imports: [
    FireormModule.forFeature([Form]),
    forwardRef(() => ClientModule),
    HttpModule
  ],
  providers: [
    FormService
  ],
  exports: [FormService],
  controllers: [FormController],
})
export class FormModule {}