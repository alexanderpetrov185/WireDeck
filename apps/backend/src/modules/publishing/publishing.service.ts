import { Inject, Injectable } from '@nestjs/common';
import { NewsService } from '../news/news.service';
import { NewsStatus } from '../news/entities/news.entity';
import { Publisher } from './providers/publisher.interface';
import { PUBLISHER_TOKEN } from './providers/publisher.token';
import { LoggerService } from '../../common/logger/logger.service';
import { PublishingResult } from './publishing-result.interface';
import { buildTelegramMessage } from './telegram-message.formatter';

/**
 * Сервис публикации новостей в Telegram.
 * Обрабатывает только news со статусом APPROVED.
 * Разрешённые переходы: APPROVED → PUBLISHED.
 *
 * Sprint 8.5 hardening:
 * - Атомарный claim (conditional UPDATE) защищает от дубликатов
 *   при конкурентных publish-запросах и повторных попытках.
 * - Telegram вызывается только ПОСЛЕ успешного claim.
 * - Если Telegram успешно отправил сообщение, но DB update не прошёл,
 *   повторная попытка НЕ отправляет дубликат: статус уже PUBLISHED.
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
    // Атомарный claim: APPROVED -> PUBLISHED.
    // Побеждает только один из конкурентных запросов; остальные получат false.
    const claimed = await this.newsService.claimForPublishing(id);

    if (!claimed) {
      // Проверяем, почему claim не удался — для точного результата.
      const news = await this.newsService.findById(id);

      if (!news) {
        this.logger.warn(`News not found for publishing: ${id}`, this.context);
        return { processed: 0, skipped: 0, errors: 1 };
      }

      if (news.status === NewsStatus.PUBLISHED) {
        // Идемпотентность: уже опубликована (в т.ч. если повторная попытка
        // после Telegram success + DB failure) -> skip, без повторной отправки.
        this.logger.debug(`News ${id} is already published, skipping`, this.context);
        return { processed: 0, skipped: 1, errors: 0 };
      }

      // Любой другой статус (или новость уже захвачена другим процессом).
      this.logger.warn(`News ${id} is in status ${news.status}, cannot publish (requires APPROVED)`, this.context);
      return { processed: 0, skipped: 0, errors: 1 };
    }

    // Claim успешен. Формируем текст публикации.
    const news = await this.newsService.findById(id);
    if (!news) {
      // Не должно происходить после успешного claim, но защищаемся.
      this.logger.error(`News ${id} disappeared after claim`, undefined, this.context);
      await this.newsService.revertPublishingClaim(id);
      return { processed: 0, skipped: 0, errors: 1 };
    }

    const text = buildTelegramMessage(news);

    try {
      const telegramMessageId = await this.publisher.publish(text);

      // Сохраняем telegramMessageId. Если DB update не пройдёт — новость
      // останется в PUBLISHED (без message_id), повторная попытка не создаст дубликат.
      const marked = await this.newsService.markPublished(id, telegramMessageId);

      if (!marked) {
        this.logger.error(
          `Failed to persist telegramMessageId for news ${id} (status no longer PUBLISHED). ` +
            `Message was sent to Telegram, but DB was not updated.`,
          undefined,
          this.context,
        );
        return { processed: 0, skipped: 0, errors: 1 };
      }

      this.logger.log(`News ${id} successfully published to Telegram, message ID: ${telegramMessageId}`, this.context);
      return { processed: 1, skipped: 0, errors: 0 };
    } catch (error) {
      // Telegram не отправил сообщение — возвращаем claim обратно в APPROVED,
      // чтобы можно было безопасно повторить. message_id пуст -> revert безопасен.
      const msg = error instanceof Error ? error.message : String(error);
      await this.newsService.revertPublishingClaim(id);
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