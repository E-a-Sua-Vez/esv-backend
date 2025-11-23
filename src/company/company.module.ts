import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { Company } from './model/company.entity';

@Module({
  imports: [FireormModule.forFeature([Company])],
  providers: [CompanyService],
  exports: [CompanyService],
  controllers: [CompanyController],
})
export class CompanyModule {}
