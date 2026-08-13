import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OpenAiProvider } from './openai.provider';
import { AI_PROVIDER } from '../ai-provider.token';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
    }),
  ],
  providers: [
    {
      provide: AI_PROVIDER,
      useClass: OpenAiProvider,
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiProviderModule {}
