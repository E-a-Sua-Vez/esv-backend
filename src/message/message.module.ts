import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { AdministratorModule } from 'src/administrator/administrator.module';
import { CommerceModule } from 'src/commerce/commerce.module';

import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { Message } from './model/message.entity';

@Module({
  imports: [
    FireormModule.forFeature([Message]),
    forwardRef(() => AdministratorModule),
    forwardRef(() => CommerceModule),
    HttpModule,
  ],
  providers: [MessageService],
  exports: [MessageService],
  controllers: [MessageController],
})
export class MessageModule {}
