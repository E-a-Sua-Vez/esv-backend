import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { PackageController } from './package.controller';
import { Package } from './model/package.entity';
import { PackageService } from './package.service';
import { IncomeModule } from '../income/income.module';

@Module({
  imports: [
    FireormModule.forFeature([Package]),
    forwardRef(() => IncomeModule),
  ],
  providers: [PackageService],
  exports: [PackageService],
  controllers: [PackageController],
})
export class PackageModule {}