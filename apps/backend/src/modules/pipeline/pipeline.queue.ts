import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, ConnectionOptions } from 'bullmq';
import { LoggerService } from '../../common/logger/logger.service';
import { PipelineProcessor } from './pipeline.processor';
import {
  PIPELINE_QUEUE_NAME,
  PIPELINE_LOCK_DURATION,
  PIPELINE_ATTEMPTS,
  PIPELINE_BACKOFF_DELAY_MS,
} from './pipeline.constants';

// DI-токены для BullMQ компонентов
export const PIPELINE_QUEUE = 'PIPELINE_QUEUE';
export const PIPELINE_WORKER = 'PIPELINE_WORKER';

/**
 * Строит connection options для BullMQ из env.
 * Queue и Worker получают ОТДЕЛЬНЫЕ подключения (BullMQ создаёт
 * собственные клиенты из этих options) — не переиспользуем один клиент.
 * maxRetriesPerRequest: null — обязательно для Worker (длинные операции).
 * enableReadyCheck: false — рекомендация BullMQ.
 * keyPrefix не используется.
 */
function buildConnectionOptions(config: ConfigService): ConnectionOptions {
  const host = config.get<string>('REDIS_HOST', 'localhost');
  const port = parseInt(config.get<string>('REDIS_PORT', '6379'), 10) || 6379;
  return {
    host,
    port,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

/**
 * BullMQ Queue (producer).
 * defaultJobOptions: attempts/backoff для job-level retry,
 * removeOnComplete/removeOnFail с age — completed/failed job'ы
 * не остаются навсегда, но живут достаточно для дедупликации.
 */
export const pipelineQueueProvider: Provider = {
  provide: PIPELINE_QUEUE,
  inject: [ConfigService, LoggerService],
  useFactory: (config: ConfigService, logger: LoggerService): Queue => {
    const queue = new Queue(PIPELINE_QUEUE_NAME, {
      connection: buildConnectionOptions(config),
      defaultJobOptions: {
        attempts: PIPELINE_ATTEMPTS,
        backoff: { type: 'exponential', delay: PIPELINE_BACKOFF_DELAY_MS },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 3600 },
      },
    });

    queue.on('error', (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        `Pipeline queue error: ${msg}`,
        error instanceof Error ? error.stack : undefined,
        'PipelineQueue',
      );
    });

    return queue;
  },
};

/**
 * BullMQ Worker (consumer).
 * concurrency: 1 — один pipeline-прогон единомоментно.
 * lockDuration — только для lock/stalled-job detection, НЕ timeout.
 */
export const pipelineWorkerProvider: Provider = {
  provide: PIPELINE_WORKER,
  inject: [ConfigService, PipelineProcessor, LoggerService],
  useFactory: (config: ConfigService, processor: PipelineProcessor, logger: LoggerService): Worker => {
    const worker = new Worker(
      PIPELINE_QUEUE_NAME,
      async (job) => processor.process(job),
      {
        connection: buildConnectionOptions(config),
        concurrency: 1,
        lockDuration: PIPELINE_LOCK_DURATION,
      },
    );

    worker.on('error', (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        `Pipeline worker error: ${msg}`,
        error instanceof Error ? error.stack : undefined,
        'PipelineWorker',
      );
    });

    worker.on('completed', (job) => {
      logger.log(`Pipeline job ${job.id} completed`, 'PipelineWorker');
    });

    worker.on('failed', (job, error) => {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        `Pipeline job ${job?.id} failed: ${msg}`,
        error instanceof Error ? error.stack : undefined,
        'PipelineWorker',
      );
    });

    return worker;
  },
};