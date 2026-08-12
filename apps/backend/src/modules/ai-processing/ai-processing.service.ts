import { Inject, Injectable } from '@nestjs/common';
import { NewsService } from '../news/news.service';
import { NewsStatus } from '../news/entities/news.entity';
import { AiProvider } from './ai-provider.interface';
import { LoggerService } from '../../common/logger/logger.service';
import { AI_PROVIDER } from './ai-provider.token';

export interface AiProcessingResult {
  processed: number;
  skipped: number;
  errors: number;
}

/**
 * Сервис AI-обработки сохранённых новостей.
 * Обрабатывает только status=RAW (переобработка PROCESSED без явного флага не выполняется).
 */
@Injectable()
export class AiProcessingService {
  private readonly context = 'AiProcessingService';

  constructor(
    private readonly newsService: NewsService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Обработка одной новости по ID.
   * @param id ID новости
   * @param force Переобработать, даже если уже PROCESSED
   */
  async processOne(id: string, force = false): Promise<AiProcessingResult> {
    const news = await this.newsService.findById(id);
    if (!news) {
      this.logger.warn(`News not found: ${id}`, this.context);
      return { processed: 0, skipped: 0, errors: 1 };
    }

    if (news.status === NewsStatus.PROCESSED && !force) {
      this.logger.debug(`News ${id} already processed, skipping`, this.context);
      return { processed: 0, skipped: 1, errors: 0 };
    }

    if (!news.rawText || news.rawText.trim().length === 0) {
      this.logger.warn(`News ${id} has no rawText, skipping`, this.context);
      return { processed: 0, skipped: 1, errors: 0 };
    }

    try {
      const aiResult = await this.aiProvider.summarize(news.rawText);
      await this.newsService.update(id, {
        summary: aiResult.summary,
        importance: aiResult.importance,
        category: aiResult.category,
        status: NewsStatus.PROCESSED,
      });
      this.logger.log(`News ${id} processed (importance=${aiResult.importance}, category=${aiResult.category})`, this.context);
      return { processed: 1, skipped: 0, errors: 0 };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process news ${id}: ${msg}`, error instanceof Error ? error.stack : undefined, this.context);
      return { processed: 0, skipped: 0, errors: 1 };
    }
  }

  /**
   * Пакетная обработка необработанных новостей (status=RAW).
   * Ошибка AI по одной новости не роняет остальной batch.
   * @param limit Максимум новостей за один прогон
   * @param force Переобработать, даже если уже PROCESSED
   */
  async processPending(limit = 50, force = false): Promise<AiProcessingResult> {
    const newsItems = await this.newsService.findByStatus(NewsStatus.RAW, limit);
    this.logger.log(`Found ${newsItems.length} raw news to process`, this.context);

    const result: AiProcessingResult = { processed: 0, skipped: 0, errors: 0 };

    for (const news of newsItems) {
      const oneItemResult = await this.processOne(news.id, force);
      result.processed += oneItemResult.processed;
      result.skipped += oneItemResult.skipped;
      result.errors += oneItemResult.errors;
    }

    this.logger.log(
      `AI processing complete. Processed: ${result.processed}, Skipped: ${result.skipped}, Errors: ${result.errors}`,
      this.context,
    );

    return result;
  }
}