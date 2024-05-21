import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { MessageController } from './message.controller';
import { Message } from './model/message.entity';
import { MessageService } from './message.service';
import { AdministratorModule } from 'src/administrator/administrator.module';
import { CommerceModule } from 'src/commerce/commerce.module';

@Module({
  imports: [
    FireormModule.forFeature([Message]),
    forwardRef(() => AdministratorModule),
    forwardRef(() => CommerceModule),
    HttpModule
  ],
  providers: [
    MessageService
  ],
  exports: [MessageService],
  controllers: [MessageController],
})
export class MessageModule {}