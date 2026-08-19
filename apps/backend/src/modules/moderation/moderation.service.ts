import { Injectable } from '@nestjs/common';
import { NewsService } from '../news/news.service';
import { NewsStatus } from '../news/entities/news.entity';
import { LoggerService } from '../../common/logger/logger.service';
import { ModerationResult } from './moderation-result.interface';

/**
 * Сервис модерации новостей.
 * Обрабатывает только news со статусом QUEUED.
 * Разрешённые переходы: QUEUED → APPROVED, QUEUED → REJECTED.
 */
@Injectable()
export class ModerationService {
  private readonly context = 'ModerationService';

  constructor(
    private readonly newsService: NewsService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Одобрение одной новости.
   * @param id ID новости
   * @param moderator Имя/ID модератора
   */
  async approveOne(id: string, moderator: string): Promise<ModerationResult> {
    if (!moderator || moderator.trim().length === 0) {
      this.logger.warn(`Moderator is required to approve news ${id}`, this.context);
      return { processed: 0, skipped: 0, errors: 1 };
    }

    const news = await this.newsService.findById(id);
    if (!news) {
      this.logger.warn(`News not found: ${id}`, this.context);
      return { processed: 0, skipped: 0, errors: 1 };
    }

    // Idempotency: уже одобрена → skip
    if (news.status === NewsStatus.APPROVED) {
      this.logger.debug(`News ${id} already approved, skipping`, this.context);
      return { processed: 0, skipped: 1, errors: 0 };
    }

    // Разрешён только переход QUEUED → APPROVED
    if (news.status !== NewsStatus.QUEUED) {
      this.logger.warn(`News ${id} is ${news.status}, cannot approve (requires QUEUED)`, this.context);
      return { processed: 0, skipped: 0, errors: 1 };
    }

    try {
      await this.newsService.update(id, {
        status: NewsStatus.APPROVED,
        moderatedBy: moderator,
        moderatedAt: new Date(),
      });
      this.logger.log(`News ${id} approved by ${moderator}`, this.context);
      return { processed: 1, skipped: 0, errors: 0 };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to approve news ${id}: ${msg}`,
        error instanceof Error ? error.stack : undefined,
        this.context,
      );
      return { processed: 0, skipped: 0, errors: 1 };
    }
  }

  /**
   * Отклонение одной новости.
   * @param id ID новости
   * @param moderator Имя/ID модератора
   * @param reason Причина отклонения (обязательна)
   */
  async rejectOne(id: string, moderator: string, reason: string): Promise<ModerationResult> {
    if (!moderator || moderator.trim().length === 0) {
      this.logger.warn(`Moderator is required to reject news ${id}`, this.context);
      return { processed: 0, skipped: 0, errors: 1 };
    }

    if (!reason || reason.trim().length === 0) {
      this.logger.warn(`Reject reason is required for news ${id}`, this.context);
      return { processed: 0, skipped: 0, errors: 1 };
    }

    const news = await this.newsService.findById(id);
    if (!news) {
      this.logger.warn(`News not found: ${id}`, this.context);
      return { processed: 0, skipped: 0, errors: 1 };
    }

    // Idempotency: уже отклонена → skip
    if (news.status === NewsStatus.REJECTED) {
      this.logger.debug(`News ${id} already rejected, skipping`, this.context);
      return { processed: 0, skipped: 1, errors: 0 };
    }

    // Разрешён только переход QUEUED → REJECTED
    if (news.status !== NewsStatus.QUEUED) {
      this.logger.warn(`News ${id} is ${news.status}, cannot reject (requires QUEUED)`, this.context);
      return { processed: 0, skipped: 0, errors: 1 };
    }

    try {
      await this.newsService.update(id, {
        status: NewsStatus.REJECTED,
        moderatedBy: moderator,
        moderatedAt: new Date(),
        rejectionReason: reason,
      });
      this.logger.log(`News ${id} rejected by ${moderator}: ${reason}`, this.context);
      return { processed: 1, skipped: 0, errors: 0 };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to reject news ${id}: ${msg}`,
        error instanceof Error ? error.stack : undefined,
        this.context,
      );
      return { processed: 0, skipped: 0, errors: 1 };
    }
  }

  /**
   * Пакетное одобрение всех новостей, ожидающих модерации (status=QUEUED).
   * Ошибка одобрения одной новости не роняет остальной batch.
   * @param limit Максимум новостей за один прогон
   */
  async approvePending(limit = 50): Promise<ModerationResult> {
    const queuedNews = await this.newsService.findByStatus(NewsStatus.QUEUED, limit);
    this.logger.log(`Found ${queuedNews.length} news to moderate`, this.context);

    const result: ModerationResult = { processed: 0, skipped: 0, errors: 0 };

    for (const news of queuedNews) {
      // В batch-режиме модератором считается система
      const oneItemResult = await this.approveOne(news.id, 'system');
      result.processed += oneItemResult.processed;
      result.skipped += oneItemResult.skipped;
      result.errors += oneItemResult.errors;
    }

    this.logger.log(
      `Moderation complete. Processed: ${result.processed}, Skipped: ${result.skipped}, Errors: ${result.errors}`,
      this.context,
    );

    return result;
  }
}