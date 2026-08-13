import { Module } from '@nestjs/common';
import { TranslationService } from './translation.service';
import { TranslationController } from './translation.controller';
import { TranslationProviderModule } from './providers/translation-provider.module';
import { NewsModule } from '../news/news.module';

@Module({
  imports: [
    NewsModule, // Для доступа к NewsService
    TranslationProviderModule, // Для DI TranslationProvider
  ],
  controllers: [TranslationController],
  providers: [TranslationService],
  exports: [TranslationService],
})
export class TranslationModule {}
