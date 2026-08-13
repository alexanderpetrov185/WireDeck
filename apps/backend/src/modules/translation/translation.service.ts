import { Inject, Injectable } from '@nestjs/common';
import { NewsService } from '../news/news.service';
import { NewsStatus, NewsLanguage } from '../news/entities/news.entity';
import { TranslationProvider } from './translation-provider.interface';
import { LoggerService } from '../../common/logger/logger.service';
import { TRANSLATION_PROVIDER } from './translation-provider.token';
import { TranslationResult } from './translation-result.interface';

/**
 * Сервис перевода сохранённых новостей.
 * Обрабатывает только status=PROCESSED (перевод RAW напрямую запрещён).
 * Повторный запуск уже переведённой новости (status=TRANSLATED) без force пропускается.
 */
@Injectable()
export class TranslationService {
  private readonly context = 'TranslationService';

  constructor(
    private readonly newsService: NewsService,
    @Inject(TRANSLATION_PROVIDER) private readonly translationProvider: TranslationProvider,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Перевод одной новости по ID.
   * @param id ID новости
   * @param targetLanguage Целевой язык перевода
   * @param force Перевести, даже если уже TRANSLATED
   */
  async translateOne(id: string, targetLanguage: string, force = false): Promise<TranslationResult> {
    const news = await this.newsService.findById(id);
    if (!news) {
      this.logger.warn(`News not found: ${id}`, this.context);
      return { processed: 0, skipped: 0, errors: 1 };
    }

    // RAW → TRANSLATED запрещено: перевод только после AI Processing (PROCESSED)
    if (news.status === NewsStatus.RAW) {
      this.logger.warn(`News ${id} is RAW, skipping translation (requires AI Processing first)`, this.context);
      return { processed: 0, skipped: 1, errors: 0 };
    }

    // Идемпотентность: уже переведена и нет force → skip
    if (news.status === NewsStatus.TRANSLATED && !force) {
      this.logger.debug(`News ${id} already translated, skipping`, this.context);
      return { processed: 0, skipped: 1, errors: 0 };
    }

    // Переводим summary (AI-генерируемую выжимку)
    if (!news.summary || news.summary.trim().length === 0) {
      this.logger.warn(`News ${id} has no summary to translate, skipping`, this.context);
      return { processed: 0, skipped: 1, errors: 0 };
    }

    try {
      const translatedText = await this.translationProvider.translate(news.summary, targetLanguage);
      await this.newsService.update(id, {
        translatedText,
        status: NewsStatus.TRANSLATED,
      });
      this.logger.log(`News ${id} translated to ${targetLanguage}`, this.context);
      return { processed: 1, skipped: 0, errors: 0 };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to translate news ${id}: ${msg}`, error instanceof Error ? error.stack : undefined, this.context);
      return { processed: 0, skipped: 0, errors: 1 };
    }
  }

  /**
   * Пакетный перевод новостей со статусом PROCESSED (и TRANSLATED при force).
   * Ошибка перевода одной новости не роняет остальной batch.
   * @param limit Максимум новостей за один прогон
   * @param targetLanguage Целевой язык перевода
   * @param force Перевести, даже если уже TRANSLATED
   */
  async translatePending(limit = 50, targetLanguage: string, force = false): Promise<TranslationResult> {
    // Всегда выбираем PROCESSED новости
    const processedNews = await this.newsService.findByStatus(NewsStatus.PROCESSED, limit);

    // При force также выбираем TRANSLATED для пере-перевода
    let newsItems = processedNews;
    if (force) {
      const translatedNews = await this.newsService.findByStatus(NewsStatus.TRANSLATED, limit);
      newsItems = [...processedNews, ...translatedNews].slice(0, limit);
    }

    this.logger.log(`Found ${newsItems.length} news to translate`, this.context);

    const result: TranslationResult = { processed: 0, skipped: 0, errors: 0 };

    for (const news of newsItems) {
      const oneItemResult = await this.translateOne(news.id, targetLanguage, force);
      result.processed += oneItemResult.processed;
      result.skipped += oneItemResult.skipped;
      result.errors += oneItemResult.errors;
    }

    this.logger.log(
      `Translation complete. Processed: ${result.processed}, Skipped: ${result.skipped}, Errors: ${result.errors}`,
      this.context,
    );

    return result;
  }
}
