import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { BusinessController } from './business.controller';
import { Business } from './model/business.entity';
import { BusinessService } from './business.service';
import { CommerceModule } from 'src/commerce/commerce.module';

@Module({
  imports: [
    FireormModule.forFeature([Business]),
    forwardRef(() => CommerceModule)
  ],
  providers: [BusinessService],
  exports: [BusinessService],
  controllers: [BusinessController],
})
export class BusinessModule {}