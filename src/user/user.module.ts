import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { UserController } from './user.controller';
import { User } from './model/user.entity';
import { UserService } from './user.service';
import { ClientModule } from 'src/client/client.module';

@Module({
  imports: [
    FireormModule.forFeature([User]),
    forwardRef(() => ClientModule),
  ],
  providers: [UserService],
  exports: [UserService],
  controllers: [UserController],
})
export class UserModule {}