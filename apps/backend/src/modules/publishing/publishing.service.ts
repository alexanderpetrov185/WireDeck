import { Inject, Injectable } from '@nestjs/common';
import { NewsService } from '../news/news.service';
import { NewsStatus } from '../news/entities/news.entity';
import { Publisher } from './providers/publisher.interface';
import { PUBLISHER_TOKEN } from './providers/publisher.token';
import { LoggerService } from '../../common/logger/logger.service';
import { PublishingResult } from './publishing-result.interface';

/**
 * Сервис публикации новостей в Telegram.
 * Обрабатывает только news со статусом APPROVED.
 * Разрешённые переходы: APPROVED → PUBLISHED.
 */
@Injectable()
export class PublishingService {
  private readonly context = 'PublishingService';

  constructor(
    private readonly newsService: NewsService,
    @Inject(PUBLISHER_TOKEN) private readonly publisher: Publisher,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Публикация одной новости по ID.
   * @param id ID новости
   */
  async publishOne(id: string): Promise<PublishingResult> {
    const news = await this.newsService.findById(id);
    if (!news) {
      this.logger.warn(`News not found for publishing: ${id}`, this.context);
      return { processed: 0, skipped: 0, errors: 1 };
    }

    // Идемпотентность: уже опубликована -> skip
    if (news.status === NewsStatus.PUBLISHED) {
      this.logger.debug(`News ${id} is already published, skipping`, this.context);
      return { processed: 0, skipped: 1, errors: 0 };
    }

    // Разрешён только переход APPROVED → PUBLISHED
    if (news.status !== NewsStatus.APPROVED) {
      this.logger.warn(`News ${id} is in status ${news.status}, cannot publish (requires APPROVED)`, this.context);
      return { processed: 0, skipped: 0, errors: 1 };
    }

    // Формируем текст публикации
    let text = '';
    if (news.title) {
      text += `${news.title}\n\n`;
    }
    if (news.translatedText) {
      text += `${news.translatedText}`;
    } else if (news.summary) {
      text += `${news.summary}`;
    } else {
      text += `${news.rawText}`;
    }
    if (news.sourceUrl) {
      text += `\n\nSource: ${news.sourceName || news.source || ''} (${news.sourceUrl})`;
    }

    try {
      const telegramMessageId = await this.publisher.publish(text.trim());
      
      await this.newsService.update(id, {
        status: NewsStatus.PUBLISHED,
        telegramMessageId,
      });

      this.logger.log(`News ${id} successfully published to Telegram, message ID: ${telegramMessageId}`, this.context);
      return { processed: 1, skipped: 0, errors: 0 };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to publish news ${id}: ${msg}`, error instanceof Error ? error.stack : undefined, this.context);
      return { processed: 0, skipped: 0, errors: 1 };
    }
  }

  /**
   * Пакетная публикация одобренных новостей.
   * @param limit Ограничение на количество новостей
   */
  async publishPending(limit = 50): Promise<PublishingResult> {
    const approvedNews = await this.newsService.findByStatus(NewsStatus.APPROVED, limit);
    this.logger.log(`Found ${approvedNews.length} news approved for publishing`, this.context);

    const result: PublishingResult = { processed: 0, skipped: 0, errors: 0 };

    for (const news of approvedNews) {
      try {
        const itemResult = await this.publishOne(news.id);
        result.processed += itemResult.processed;
        result.skipped += itemResult.skipped;
        result.errors += itemResult.errors;
      } catch (error) {
        this.logger.error(`Unhandled error during batch publishing of news ${news.id}: ${error}`, undefined, this.context);
        result.errors += 1;
      }
    }

    this.logger.log(
      `Batch publishing complete. Processed: ${result.processed}, Skipped: ${result.skipped}, Errors: ${result.errors}`,
      this.context,
    );

    return result;
  }
}
