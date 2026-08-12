import { Module } from '@nestjs/common';
import { AiProvider } from '../ai-provider.interface';
import { OpenAiProvider } from './openai.provider';
import { AI_PROVIDER } from '../ai-provider.token';

@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      useClass: OpenAiProvider,
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiProviderModule {}