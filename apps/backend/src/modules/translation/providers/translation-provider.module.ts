import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OpenAiTranslationProvider } from './openai-translation.provider';
import { TRANSLATION_PROVIDER } from '../translation-provider.token';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
    }),
  ],
  providers: [
    {
      provide: TRANSLATION_PROVIDER,
      useClass: OpenAiTranslationProvider,
    },
  ],
  exports: [TRANSLATION_PROVIDER],
})
export class TranslationProviderModule {}
