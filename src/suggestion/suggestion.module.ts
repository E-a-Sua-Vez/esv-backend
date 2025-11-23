import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { AttentionModule } from 'src/attention/attention.module';

import { SuggestionController } from './suggestion.controller';
import { Suggestion } from './suggestion.entity';
import { SuggestionService } from './suggestion.service';

@Module({
  imports: [FireormModule.forFeature([Suggestion]), forwardRef(() => AttentionModule)],
  providers: [SuggestionService],
  exports: [SuggestionService],
  controllers: [SuggestionController],
})
export class SuggestionModule {}
