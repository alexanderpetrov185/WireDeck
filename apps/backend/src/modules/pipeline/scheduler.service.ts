import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { LoggerService } from '../../common/logger/logger.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { PIPELINE_QUEUE } from './pipeline.queue';
import {
  PIPELINE_QUEUE_NAME,
  PIPELINE_JOB_NAME,
  PIPELINE_JOB_ID,
  PIPELINE_ATTEMPTS,
  PIPELINE_BACKOFF_DELAY_MS,
  DEFAULT_SCHEDULER_ENABLED,
  DEFAULT_PIPELINE_INTERVAL_MS,
  MIN_PIPELINE_INTERVAL_MS,
} from './pipeline.constants';

/**
 * Классификация состояния job для дедупликации scheduled runs.
 * Активные состояния — новый job не создаётся.
 * Завершённые состояния — следующий run может создать новый job.
 */
const ACTIVE_JOB_STATES = new Set(['active', 'waiting', 'delayed', 'prioritized', 'waiting-children']);

/**
 * Периодический планировщик pipeline.
 *
 * - Включается только при SCHEDULER_ENABLED=true (дефолт false).
 * - Интервал из PIPELINE_INTERVAL_MS с валидацией (минимум MIN_PIPELINE_INTERVAL_MS).
 * - Каждый тик вызывает enqueueJob(), который дедуплицируется через фиксированный
 *   jobId: если существует активный job — пропускаем; если completed/failed —
 *   удаляем старый и создаём новый.
 */
@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly context = 'SchedulerService';
  private schedulerTimer: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private readonly enabled: boolean;

  constructor(
    @Inject(PIPELINE_QUEUE) private readonly queue: Queue,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {
    this.enabled =
      this.configService.get<string>('SCHEDULER_ENABLED', String(DEFAULT_SCHEDULER_ENABLED)) === 'true';
    this.intervalMs = this.resolveIntervalMs();
  }

  /**
   * Валидация интервала: положительное разумное значение.
   * Некорректные значения не приводят к неконтролируемому setInterval.
   */
  private resolveIntervalMs(): number {
    const raw = this.configService.get<string>('PIPELINE_INTERVAL_MS', String(DEFAULT_PIPELINE_INTERVAL_MS));
    const parsed = Number(raw);
    if (isNaN(parsed) || !isFinite(parsed) || parsed < MIN_PIPELINE_INTERVAL_MS) {
      this.logger.warn(
        `Invalid PIPELINE_INTERVAL_MS "${raw}", using default ${DEFAULT_PIPELINE_INTERVAL_MS}`,
        this.context,
      );
      return DEFAULT_PIPELINE_INTERVAL_MS;
    }
    return parsed;
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log(
        `Scheduler disabled (SCHEDULER_ENABLED != true). No jobs will be auto-created. Configured interval would be ${this.intervalMs}ms.`,
        this.context,
      );
      return;
    }

    this.logger.log(`Scheduler enabled, interval: ${this.intervalMs}ms`, this.context);

    // Немедленный запуск при старте
    this.enqueueJob().catch((error) => {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Scheduler initial enqueue failed: ${msg}`, error instanceof Error ? error.stack : undefined, this.context);
    });

    this.schedulerTimer = setInterval(() => {
      this.enqueueJob().catch((error) => {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Scheduler enqueue failed: ${msg}`, error instanceof Error ? error.stack : undefined, this.context);
      });
    }, this.intervalMs);
  }

  /**
   * Остановка планировщика: новые jobs больше не enqueue.
   */
  onModuleDestroy(): void {
    this.stop();
  }

  /**
   * Публичная остановка планировщика (вызывается также из PipelineLifecycle
   * для строго определённого порядка graceful shutdown).
   */
  stop(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.logger.log('Scheduler stopped. No new jobs will be enqueued.', this.context);
  }

  /**
   * Добавление pipeline job с дедупликацией.
   * Публичный метод — также используется ручным trigger endpoint.
   */
  async enqueueJob(): Promise<boolean> {
    const existing = await this.queue.getJob(PIPELINE_JOB_ID);

    if (existing) {
      const state = await existing.getState();

      if (ACTIVE_JOB_STATES.has(state)) {
        this.logger.debug(
          `Pipeline job already ${state}. Skipping duplicate enqueue.`,
          this.context,
        );
        return false;
      }

      // completed / failed / unknown — удаляем старое, чтобы следующий run создал новый job.
      this.logger.log(
        `Previous pipeline job is in state "${state}". Removing and creating a fresh job.`,
        this.context,
      );
      await existing.remove();
    }

    await this.queue.add(
      PIPELINE_JOB_NAME,
      {},
      {
        jobId: PIPELINE_JOB_ID,
        attempts: PIPELINE_ATTEMPTS,
        backoff: { type: 'exponential', delay: PIPELINE_BACKOFF_DELAY_MS },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 3600 },
      },
    );

    this.logger.log('Pipeline job enqueued', this.context);
    this.metrics.updateQueueSize(PIPELINE_QUEUE_NAME, 1);
    return true;
  }
}