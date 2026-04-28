import { Module } from '@nestjs/common';
import { IntegrationModule } from '../integration/integration.module';
import { LlmService } from './llm.service';

@Module({
  imports: [IntegrationModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
