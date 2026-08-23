import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { PipelineService, PipelineResult } from './pipeline.service';
import { LoggerService } from '../../common/logger/logger.service';

/**
 * Обработчик job'ов BullMQ для pipeline.
 * Техническое job-level исключение (unhandled) пробрасывается,
 * чтобы BullMQ мог применить attempts/backoff (retry).
 * Ошибки отдельных pipeline-шагов НЕ пробрасываются — они отражены
 * в PipelineResult (см. PipelineService.safeStep).
 */
@Injectable()
export class PipelineProcessor {
  private readonly context = 'PipelineProcessor';

  constructor(
    private readonly pipelineService: PipelineService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Обработка job'а полного pipeline.
   * @param job BullMQ job
   */
  async process(job: Job): Promise<PipelineResult> {
    this.logger.log(`Processing pipeline job "${job.name}" (id: ${job.id})`, this.context);

    const result = await this.pipelineService.runFullPipeline();

    this.logger.log(
      `Pipeline job "${job.name}" (id: ${job.id}) completed. Total errors: ${result.totalErrors}`,
      this.context,
    );

    return result;
  }
}