import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { CompanyController } from './company.controller';
import { Company } from './model/company.entity';
import { CompanyService } from './company.service';

@Module({
  imports: [
    FireormModule.forFeature([Company]),
  ],
  providers: [CompanyService],
  exports: [CompanyService],
  controllers: [CompanyController],
})
export class CompanyModule {}