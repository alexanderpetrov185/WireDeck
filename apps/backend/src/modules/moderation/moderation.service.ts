import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsService } from '../news/news.service';
import { NewsStatus } from '../news/entities/news.entity';
import { LoggerService } from '../../common/logger/logger.service';
import { ModerationResult } from './moderation-result.interface';
import {
  DEFAULT_MODERATION_AUTO_IMPORTANCE_MIN,
  DEFAULT_MODERATION_MODE,
  MODERATION_MODES,
  ModerationMode,
} from '../pipeline/pipeline.constants';

/**
 * Сервис модерации новостей.
 * Обрабатывает только news со статусом QUEUED.
 * Разрешённые переходы: QUEUED → APPROVED, QUEUED → REJECTED.
 *
 * Sprint 14: moderation policy через MODERATION_MODE:
 * - auto   — pipeline одобряет все QUEUED (как раньше);
 * - manual — pipeline ничего не трогает, всё решает человек в админке;
 * - hybrid — auto только для sufficiently important
 *            (importance >= MODERATION_AUTO_IMPORTANCE_MIN), остальное ждёт человека.
 */
@Injectable()
export class ModerationService {
  private readonly context = 'ModerationService';
  private readonly mode: ModerationMode;
  private readonly autoImportanceMin: number;

  constructor(
    private readonly newsService: NewsService,
    private readonly logger: LoggerService,
    configService: ConfigService,
  ) {
    const rawMode = configService.get<string>('MODERATION_MODE', DEFAULT_MODERATION_MODE);
    if (MODERATION_MODES.includes(rawMode as ModerationMode)) {
      this.mode = rawMode as ModerationMode;
    } else {
      this.logger.warn(
        `Invalid MODERATION_MODE "${rawMode}", falling back to "${DEFAULT_MODERATION_MODE}"`,
        this.context,
      );
      this.mode = DEFAULT_MODERATION_MODE;
    }

    const rawMin = configService.get<number>(
      'MODERATION_AUTO_IMPORTANCE_MIN',
      DEFAULT_MODERATION_AUTO_IMPORTANCE_MIN,
    );
    const parsedMin = Number(rawMin);
    if (isNaN(parsedMin) || parsedMin < 0 || parsedMin > 1) {
      this.logger.warn(
        `Invalid MODERATION_AUTO_IMPORTANCE_MIN "${rawMin}", using default ${DEFAULT_MODERATION_AUTO_IMPORTANCE_MIN}`,
        this.context,
      );
      this.autoImportanceMin = DEFAULT_MODERATION_AUTO_IMPORTANCE_MIN;
    } else {
      this.autoImportanceMin = parsedMin;
    }

    // Sprint 14 hotfix: явный лог resolved-политики на bootstrap,
    // чтобы сразу видеть, какой режим реально работает в контейнере.
    this.logger.log(
      `Moderation policy resolved: mode=${this.mode}, autoImportanceMin=${this.autoImportanceMin}`,
      this.context,
    );
  }

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
   * Sprint 14: поведение зависит от MODERATION_MODE:
   * - manual: no-op — очередь ждёт человека в админке;
   * - auto: одобряются все QUEUED (moderator='system');
   * - hybrid: auto только при importance >= MODERATION_AUTO_IMPORTANCE_MIN.
   * Ошибка одобрения одной новости не роняет остальной batch.
   * @param limit Максимум новостей за один прогон
   */
  async approvePending(limit = 50): Promise<ModerationResult> {
    const queuedNews = await this.newsService.findByStatus(NewsStatus.QUEUED, limit);

    if (this.mode === 'manual') {
      this.logger.log(
        `Moderation step: mode=manual, left awaiting review: ${queuedNews.length}`,
        this.context,
      );
      return { processed: 0, skipped: queuedNews.length, errors: 0 };
    }

    this.logger.log(`Found ${queuedNews.length} news to moderate (mode: ${this.mode})`, this.context);

    const result: ModerationResult = { processed: 0, skipped: 0, errors: 0 };

    for (const news of queuedNews) {
      // В batch-режиме модератором считается система.
      if (this.mode === 'hybrid') {
        if (typeof news.importance !== 'number' || news.importance < this.autoImportanceMin) {
          result.skipped += 1;
          continue;
        }
      }
      const oneItemResult = await this.approveOne(news.id, 'system');
      result.processed += oneItemResult.processed;
      result.skipped += oneItemResult.skipped;
      result.errors += oneItemResult.errors;
    }

    if (this.mode === 'hybrid') {
      this.logger.log(
        `hybrid: approved ${result.processed}, left queued ${result.skipped} (threshold=${this.autoImportanceMin})`,
        this.context,
      );
    } else {
      this.logger.log(
        `Moderation complete. Processed: ${result.processed}, Skipped: ${result.skipped}, Errors: ${result.errors}`,
        this.context,
      );
    }

    return result;
  }
}