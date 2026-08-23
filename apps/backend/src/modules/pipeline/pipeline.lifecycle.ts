import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { LoggerService } from '../../common/logger/logger.service';
import { PIPELINE_QUEUE, PIPELINE_WORKER } from './pipeline.queue';
import { SchedulerService } from './scheduler.service';

/**
 * Graceful shutdown для BullMQ (Sprint 9).
 *
 * Порядок завершения (строго по требованию):
 * 1. Остановить Scheduler — новые jobs больше не enqueue.
 * 2. Закрыть Worker и дождаться завершения текущей обработки.
 * 3. Закрыть Queue / Redis resources.
 */
@Injectable()
export class PipelineLifecycle implements OnModuleDestroy {
  private readonly context = 'PipelineLifecycle';

  constructor(
    private readonly scheduler: SchedulerService,
    @Inject(PIPELINE_WORKER) private readonly worker: Worker,
    @Inject(PIPELINE_QUEUE) private readonly queue: Queue,
    private readonly logger: LoggerService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Graceful shutdown started (scheduler → worker → queue)', this.context);

    // 1. Scheduler
    this.scheduler.stop();

    // 2. Worker — закрываем и ждём завершения текущего job.
    try {
      await this.worker.close();
      this.logger.log('Pipeline worker closed', this.context);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Pipeline worker close error: ${msg}`,
        error instanceof Error ? error.stack : undefined,
        this.context,
      );
    }

    // 3. Queue / Redis
    try {
      await this.queue.close();
      this.logger.log('Pipeline queue closed', this.context);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Pipeline queue close error: ${msg}`,
        error instanceof Error ? error.stack : undefined,
        this.context,
      );
    }

    this.logger.log('Graceful shutdown completed', this.context);
  }
}