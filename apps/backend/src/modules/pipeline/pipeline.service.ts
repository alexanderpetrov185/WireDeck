import { Injectable } from '@nestjs/common';
import { IngestionService, IngestionResult } from '../ingestion/ingestion.service';
import { AiProcessingService, AiProcessingResult } from '../ai-processing/ai-processing.service';
import { TranslationService } from '../translation/translation.service';
import { TranslationResult } from '../translation/translation-result.interface';
import { ModerationService } from '../moderation/moderation.service';
import { ModerationResult } from '../moderation/moderation-result.interface';
import { PublishingService } from '../publishing/publishing.service';
import { PublishingResult } from '../publishing/publishing-result.interface';
import { LoggerService } from '../../common/logger/logger.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { captureException } from '../../common/sentry/sentry.config';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_PIPELINE_BATCH_LIMIT } from './pipeline.constants';

/**
 * Результат одного шага pipeline.
 * Техническое выполнение шага (ok) и ошибки внутри шага (errors) различимы.
 */
export interface PipelineStepResult {
  name: string;
  ok: boolean;
  result: IngestionResult | AiProcessingResult | TranslationResult | ModerationResult | PublishingResult;
}

/**
 * Итоговый результат полного pipeline-прогона.
 */
export interface PipelineResult {
  steps: PipelineStepResult[];
  totalErrors: number;
  completedAt: Date;
}

/**
 * Оркестрация существующего pipeline:
 * Ingestion → AI Processing → Translation → Moderation → Publishing.
 *
 * Каждый шаг вызывает существующий сервис без переписывания.
 * Ошибка отдельного шага НЕ останавливает остальные pending-based шаги.
 * Ошибки шагов НЕ превращаются автоматически в BullMQ retry —
 * retry остаётся для необработанного job-level failure.
 */
@Injectable()
export class PipelineService {
  private readonly context = 'PipelineService';

  constructor(
    private readonly ingestionService: IngestionService,
    private readonly aiProcessingService: AiProcessingService,
    private readonly translationService: TranslationService,
    private readonly moderationService: ModerationService,
    private readonly publishingService: PublishingService,
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Запуск полного pipeline.
   * @returns PipelineResult с результатами каждого шага
   */
  async runFullPipeline(): Promise<PipelineResult> {
    const limit = this.resolveBatchLimit();
    const targetLanguage = this.configService.get<string>('TRANSLATION_TARGET_LANGUAGE', 'en');

    this.logger.log(`Pipeline run started (batch limit: ${limit}, target language: ${targetLanguage})`, this.context);

    const steps: PipelineStepResult[] = [];
    let totalErrors = 0;

    // Шаг 1: Ingestion
    const ingestion = await this.safeStep('ingestion', () => this.ingestionService.ingestFromRss());
    steps.push(ingestion);
    totalErrors += this.stepErrors(ingestion);

    // Шаг 2: AI Processing
    const ai = await this.safeStep('ai-processing', () => this.aiProcessingService.processPending(limit));
    steps.push(ai);
    totalErrors += this.stepErrors(ai);

    // Шаг 3: Translation
    const translation = await this.safeStep('translation', () =>
      this.translationService.translatePending(limit, targetLanguage),
    );
    steps.push(translation);
    totalErrors += this.stepErrors(translation);

    // Шаг 4: Moderation
    const moderation = await this.safeStep('moderation', () => this.moderationService.approvePending(limit));
    steps.push(moderation);
    totalErrors += this.stepErrors(moderation);

    // Шаг 5: Publishing
    const publishing = await this.safeStep('publishing', () => this.publishingService.publishPending(limit));
    steps.push(publishing);
    totalErrors += this.stepErrors(publishing);

    const result: PipelineResult = {
      steps,
      totalErrors,
      completedAt: new Date(),
    };

    this.logger.log(
      `Pipeline run complete. Steps: ${steps.length}, Total errors: ${totalErrors}`,
      this.context,
    );

    return result;
  }

  /**
   * Выполняет шаг с изоляцией ошибок: технический сбой шага логируется,
   * но не останавливает остальные шаги.
   */
  private async safeStep(
    name: string,
    fn: () => Promise<IngestionResult | AiProcessingResult | TranslationResult | ModerationResult | PublishingResult>,
  ): Promise<PipelineStepResult> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.metrics.observeQueueJob('wiredeck-pipeline', name, 'completed', duration / 1000);
      this.logger.log(`Pipeline step "${name}" completed in ${duration}ms`, this.context);
      return { name, ok: true, result };
    } catch (error) {
      const duration = Date.now() - start;
      const msg = error instanceof Error ? error.message : String(error);
      this.metrics.observeQueueJob('wiredeck-pipeline', name, 'failed', duration / 1000);
      this.logger.error(`Pipeline step "${name}" failed: ${msg}`, error instanceof Error ? error.stack : undefined, this.context);
      // Sentry: только здесь (шаг не пробрасывается выше, worker 'failed' его
      // не увидит — дублирования одного exception нет).
      if (error instanceof Error) {
        captureException(error, { pipelineStep: name });
      }
      return {
        name,
        ok: false,
        result: { processed: 0, skipped: 0, errors: 1 },
      };
    }
  }

  /**
   * Суммирует ошибки из результата шага.
   */
  private stepErrors(step: PipelineStepResult): number {
    if (!step.ok) {
      return 1;
    }
    const r = step.result as { errors?: number };
    return r.errors ?? 0;
  }

  /**
   * Валидация batch limit из env: положительное число, иначе дефолт.
   */
  private resolveBatchLimit(): number {
    const raw = this.configService.get<string>(
      'PIPELINE_BATCH_LIMIT',
      String(DEFAULT_PIPELINE_BATCH_LIMIT),
    );
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed <= 0) {
      this.logger.warn(
        `Invalid PIPELINE_BATCH_LIMIT "${raw}", using default ${DEFAULT_PIPELINE_BATCH_LIMIT}`,
        this.context,
      );
      return DEFAULT_PIPELINE_BATCH_LIMIT;
    }
    return parsed;
  }
}