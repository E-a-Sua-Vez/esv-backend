import { Module } from '@nestjs/common';

import { DigitalSignatureService } from '../services/digital-signature.service';

@Module({
  providers: [DigitalSignatureService],
  exports: [DigitalSignatureService],
})
export class DigitalSignatureModule {}











