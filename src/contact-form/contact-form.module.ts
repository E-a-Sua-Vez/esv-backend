import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { ContactFormController } from './contact-form.controller';
import { ContactFormService } from './contact-form.service';
import { ContactFormSubmission } from './model/contact-form.entity';

@Module({
  imports: [FireormModule.forFeature([ContactFormSubmission])],
  providers: [ContactFormService],
  exports: [ContactFormService],
  controllers: [ContactFormController],
})
export class ContactFormModule {}
