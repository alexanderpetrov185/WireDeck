import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { LoggerService } from '../../common/logger/logger.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { PIPELINE_QUEUE_NAME } from './pipeline.constants';
import { PIPELINE_QUEUE } from './pipeline.queue';

const DEFAULT_STATS_INTERVAL_MS = 15000;
const MIN_STATS_INTERVAL_MS = 5000;

/**
 * Периодический сбор реальных счётчиков BullMQ в Prometheus gauges (Sprint 11).
 * Использует queue.getJobCounts() — состояния waiting/active/completed/failed/delayed.
 * Не меняет стратегию jobId/scheduler/retry — только observability.
 */
@Injectable()
export class QueueStatsService implements OnModuleInit, OnModuleDestroy {
  private readonly context = 'QueueStatsService';
  private statsTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(PIPELINE_QUEUE) private readonly queue: Queue,
    private readonly configService: ConfigService,
    private readonly metrics: MetricsService,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit(): void {
    const raw = this.configService.get<string>('PIPELINE_STATS_INTERVAL_MS', String(DEFAULT_STATS_INTERVAL_MS));
    const parsed = Number(raw);
    const intervalMs =
      isNaN(parsed) || !isFinite(parsed) || parsed < MIN_STATS_INTERVAL_MS
        ? DEFAULT_STATS_INTERVAL_MS
        : parsed;

    // Немедленный первый сбор + периодический
    this.collect().catch(() => undefined);
    this.statsTimer = setInterval(() => {
      this.collect().catch((error) => {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Queue stats collection failed: ${msg}`, undefined, this.context);
      });
    }, intervalMs);

    this.logger.log(`Queue stats collector started (interval: ${intervalMs}ms)`, this.context);
  }

  onModuleDestroy(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
      this.logger.log('Queue stats collector stopped', this.context);
    }
  }

  /**
   * Сбор текущих счётчиков очереди в метрики.
   */
  async collect(): Promise<void> {
    const counts = await this.queue.getJobCounts();
    this.metrics.setQueueJobCounts(PIPELINE_QUEUE_NAME, counts as unknown as Record<string, number>);
  }
}
