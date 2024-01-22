import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { UserController } from './user.controller';
import { User } from './user.entity';
import { UserService } from './user.service';

@Module({
  imports: [
    FireormModule.forFeature([User])
  ],
  providers: [UserService],
  exports: [UserService],
  controllers: [UserController],
})
export class UserModule {}