import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsService } from '../news/news.service';
import { LoggerService } from '../../common/logger/logger.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { captureMessage } from '../../common/sentry/sentry.config';

const DEFAULT_SWEEP_INTERVAL_MS = 600000; // 10 минут
const MIN_SWEEP_INTERVAL_MS = 30000;
const DEFAULT_STUCK_THRESHOLD_MS = 3600000; // 1 час

/**
 * Детектор застрявших публикаций (Sprint 11).
 *
 * Закрывает окно Sprint 8.5: crash процесса между claim
 * (APPROVED -> PUBLISHED) и фактическим Telegram publish оставляет новость
 * в PUBLISHED без telegram_message_id навсегда.
 *
 * ВАЖНО: ТОЛЬКО detection/observability.
 * Никакого auto-revert и auto-retry публикации:
 * после crash неизвестно, было ли сообщение реально отправлено в Telegram,
 * поэтому повторная публикация может создать дубль в канале.
 * Восстановление — вручную по docs/FAILURE_MODES.md.
 */
@Injectable()
export class PublishingStuckSweeperService implements OnModuleInit, OnModuleDestroy {
  private readonly context = 'PublishingStuckSweeper';
  private sweepTimer: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private readonly thresholdMs: number;

  constructor(
    private readonly newsService: NewsService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {
    const rawInterval = this.configService.get<string>(
      'PUBLISHING_STUCK_SWEEP_INTERVAL_MS',
      String(DEFAULT_SWEEP_INTERVAL_MS),
    );
    const parsedInterval = Number(rawInterval);
    this.intervalMs =
      isNaN(parsedInterval) || !isFinite(parsedInterval) || parsedInterval < MIN_SWEEP_INTERVAL_MS
        ? DEFAULT_SWEEP_INTERVAL_MS
        : parsedInterval;

    const rawThreshold = this.configService.get<string>(
      'PUBLISHING_STUCK_THRESHOLD_MS',
      String(DEFAULT_STUCK_THRESHOLD_MS),
    );
    const parsedThreshold = Number(rawThreshold);
    this.thresholdMs =
      isNaN(parsedThreshold) || !isFinite(parsedThreshold) || parsedThreshold <= 0
        ? DEFAULT_STUCK_THRESHOLD_MS
        : parsedThreshold;
  }

  onModuleInit(): void {
    // Первый sweep отложенный — не блокируем старт приложения
    this.sweepTimer = setInterval(() => {
      this.sweep().catch((error) => {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Publishing stuck sweep failed: ${msg}`, undefined, this.context);
      });
    }, this.intervalMs);

    this.logger.log(
      `Publishing stuck sweeper started (interval: ${this.intervalMs}ms, threshold: ${this.thresholdMs}ms)`,
      this.context,
    );
  }

  /** Корректная остановка таймера при graceful shutdown. */
  onModuleDestroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
      this.logger.log('Publishing stuck sweeper stopped', this.context);
    }
  }

  /**
   * Один проход детекции. ТОЛЬКО чтение + метрика/логи/Sentry.
   * @returns Количество найденных stuck-записей
   */
  async sweep(): Promise<number> {
    const stuck = await this.newsService.findStuckPublished(this.thresholdMs);
    this.metrics.setPublishingStuck(stuck.length);

    if (stuck.length === 0) {
      return 0;
    }

    // ID — только в логах/Sentry, НЕ в метриках (low-cardinality).
    for (const news of stuck) {
      this.logger.error(
        `STUCK PUBLISHING detected: news ${news.id} is PUBLISHED without telegram_message_id ` +
          `(updatedAt: ${news.updatedAt.toISOString()}). ` +
          'Likely crash between publish claim and Telegram publish. ' +
          'Manual recovery required (see docs/FAILURE_MODES.md). DO NOT auto-republish.',
        undefined,
        this.context,
      );
    }

    captureMessage(`Detected ${stuck.length} stuck published news (no telegram_message_id)`, 'error');

    return stuck.length;
  }

  /**
   * Текущий список stuck-новостей для ручной диагностики (GET /pipeline/stuck).
   */
  async getStuck(): Promise<Array<{ id: string; updatedAt: string }>> {
    const stuck = await this.newsService.findStuckPublished(this.thresholdMs);
    return stuck.map((n) => ({ id: n.id, updatedAt: n.updatedAt.toISOString() }));
  }
}
