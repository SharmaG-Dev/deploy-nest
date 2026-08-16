import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiToolsModule } from '../ai-tools/ai-tools.module';

@Module({
  imports: [AiToolsModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
