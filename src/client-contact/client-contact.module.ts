import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';;
import { ClientContact } from './model/client-contact.entity';
import { ClientContactService } from './client-contact.service';

@Module({
  imports: [
    FireormModule.forFeature([ClientContact])
  ],
  providers: [ClientContactService],
  exports: [ClientContactService],
  controllers: [],
})
export class ClientContactModule {}