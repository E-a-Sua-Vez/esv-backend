import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { IncomeModule } from '../income/income.module';

import { Package } from './model/package.entity';
import { PackageController } from './package.controller';
import { PackageService } from './package.service';

@Module({
  imports: [FireormModule.forFeature([Package]), forwardRef(() => IncomeModule)],
  providers: [PackageService],
  exports: [PackageService],
  controllers: [PackageController],
})
export class PackageModule {}
