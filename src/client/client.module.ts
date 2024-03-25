import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';;
import { Client } from './model/client.entity';
import { ClientService } from './client.service';
import { ClientContactModule } from '../client-contact/client-contact.module';
import { ClientController } from './client.controller';
import { CommerceModule } from '../commerce/commerce.module';

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