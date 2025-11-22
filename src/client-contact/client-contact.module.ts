import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { ClientContactService } from './client-contact.service';
import { ClientContact } from './model/client-contact.entity';

@Module({
  imports: [FireormModule.forFeature([ClientContact])],
  providers: [ClientContactService],
  exports: [ClientContactService],
  controllers: [],
})
export class ClientContactModule {}
