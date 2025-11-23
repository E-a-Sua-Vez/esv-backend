import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { ClientContactModule } from '../client-contact/client-contact.module';
import { CommerceModule } from '../commerce/commerce.module';

import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { Client } from './model/client.entity';

@Module({
  imports: [
    FireormModule.forFeature([Client]),
    forwardRef(() => ClientContactModule),
    forwardRef(() => CommerceModule),
  ],
  providers: [ClientService],
  exports: [ClientService],
  controllers: [ClientController],
})
export class ClientModule {}
