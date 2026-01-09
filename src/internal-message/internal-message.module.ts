import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { InternalMessageController } from './internal-message.controller';
import { InternalMessageService } from './internal-message.service';
import { InternalMessage } from './model/internal-message.entity';
import { MessageConversation } from './model/message-conversation.entity';

@Module({
  imports: [FireormModule.forFeature([InternalMessage, MessageConversation])],
  controllers: [InternalMessageController],
  providers: [InternalMessageService],
  exports: [InternalMessageService],
})
export class InternalMessageModule {}
