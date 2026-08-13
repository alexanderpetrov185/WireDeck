import { Module } from '@nestjs/common';
import { TranslationProvider } from '../translation-provider.interface';
import { OpenAiTranslationProvider } from './openai-translation.provider';
import { TRANSLATION_PROVIDER } from '../translation-provider.token';

@Module({
  providers: [
    {
      provide: TRANSLATION_PROVIDER,
      useClass: OpenAiTranslationProvider,
    },
  ],
  exports: [TRANSLATION_PROVIDER],
})
export class TranslationProviderModule {}
