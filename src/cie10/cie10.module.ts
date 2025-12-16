import { Module } from '@nestjs/common';

import { CIE10Controller } from './cie10.controller';
import { CIE10Service } from './cie10.service';

@Module({
  providers: [CIE10Service],
  exports: [CIE10Service],
  controllers: [CIE10Controller],
})
export class CIE10Module {}
