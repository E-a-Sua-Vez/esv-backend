import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { ClientModule } from '../client/client.module';

import { FormController } from './form.controller';
import { FormService } from './form.service';
import { Form } from './model/form.entity';

@Module({
  imports: [FireormModule.forFeature([Form]), forwardRef(() => ClientModule), HttpModule],
  providers: [FormService],
  exports: [FormService],
  controllers: [FormController],
})
export class FormModule {}
