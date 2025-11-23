import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { ClientModule } from 'src/client/client.module';
import { CommerceModule } from 'src/commerce/commerce.module';

import { User } from './model/user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [
    FireormModule.forFeature([User]),
    forwardRef(() => ClientModule),
    forwardRef(() => CommerceModule),
  ],
  providers: [UserService],
  exports: [UserService],
  controllers: [UserController],
})
export class UserModule {}
