import { Inject, Injectable } from '@nestjs/common';
import { NewsService } from '../news/news.service';
import { NewsStatus } from '../news/entities/news.entity';
import { AiProvider } from './ai-provider.interface';
import { LoggerService } from '../../common/logger/logger.service';
import { AI_PROVIDER } from './ai-provider.token';
import { RateLimitError } from '../../common/rate-limit/rate-limited.client';

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
        // Sprint 22a: market-impact поля (undefined → не перезаписываем).
        ...(aiResult.impactScore !== undefined && { impactScore: aiResult.impactScore }),
        ...(aiResult.impactThesis !== undefined && { impactThesis: aiResult.impactThesis }),
        ...(aiResult.affectedAssets !== undefined && { affectedAssets: aiResult.affectedAssets }),
        ...(aiResult.affectedSectors !== undefined && { affectedSectors: aiResult.affectedSectors }),
        ...(aiResult.timeHorizon !== undefined && { timeHorizon: aiResult.timeHorizon }),
        status: NewsStatus.PROCESSED,
      });
      const impactPart = aiResult.impactScore !== undefined ? `, impact=${aiResult.impactScore}` : '';
      this.logger.log(`News ${id} processed (importance=${aiResult.importance}${impactPart}, category=${aiResult.category})`, this.context);
      return { processed: 1, skipped: 0, errors: 0 };
    } catch (error) {
      // Sprint 12: rate limit пробрасывается — processPending сделает ранний
      // выход из batch и отложит остальные новости на следующий прогон.
      if (error instanceof RateLimitError) {
        throw error;
      }
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process news ${id}: ${msg}`, error instanceof Error ? error.stack : undefined, this.context);
      return { processed: 0, skipped: 0, errors: 1 };
    }
  }

  /**
   * Пакетная обработка необработанных новостей (status=RAW).
   * Ошибка AI по одной новости не роняет остальной batch.
   * Sprint 12: при rate limit (429 после ретраев) — ранний выход,
   * оставшиеся новости считаются skipped (deferred на следующий прогон).
   * @param limit Максимум новостей за один прогон
   * @param force Переобработать, даже если уже PROCESSED
   */
  async processPending(limit = 50, force = false): Promise<AiProcessingResult> {
    const newsItems = await this.newsService.findByStatus(NewsStatus.RAW, limit);
    this.logger.log(`Found ${newsItems.length} raw news to process`, this.context);

    const result: AiProcessingResult = { processed: 0, skipped: 0, errors: 0 };

    for (let i = 0; i < newsItems.length; i++) {
      try {
        const oneItemResult = await this.processOne(newsItems[i].id, force);
        result.processed += oneItemResult.processed;
        result.skipped += oneItemResult.skipped;
        result.errors += oneItemResult.errors;
      } catch (error) {
        if (error instanceof RateLimitError) {
          const deferred = newsItems.length - i;
          result.skipped += deferred;
          this.logger.warn(
            `AI rate limit reached, deferring ${deferred} remaining items to the next run`,
            this.context,
          );
          break;
        }
        throw error;
      }
    }

    this.logger.log(
      `AI processing complete. Processed: ${result.processed}, Skipped: ${result.skipped}, Errors: ${result.errors}`,
      this.context,
    );

    return result;
  }
}