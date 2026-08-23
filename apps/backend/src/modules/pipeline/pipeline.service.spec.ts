import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PipelineService, PipelineStepResult } from './pipeline.service';
import { IngestionService, IngestionResult } from '../ingestion/ingestion.service';
import { AiProcessingService, AiProcessingResult } from '../ai-processing/ai-processing.service';
import { TranslationService } from '../translation/translation.service';
import { ModerationService } from '../moderation/moderation.service';
import { PublishingService } from '../publishing/publishing.service';
import { LoggerService } from '../../common/logger/logger.service';
import { MetricsService } from '../../common/metrics/metrics.service';

describe('PipelineService', () => {
  let service: PipelineService;
  let ingestionService: IngestionService;
  let aiProcessingService: AiProcessingService;
  let translationService: TranslationService;
  let moderationService: ModerationService;
  let publishingService: PublishingService;

  const okResult = { processed: 1, skipped: 0, errors: 0 };

  const moduleRef = async () =>
    Test.createTestingModule({
      providers: [
        PipelineService,
        {
          provide: IngestionService,
          useValue: { ingestFromRss: jest.fn().mockResolvedValue(okResult) },
        },
        {
          provide: AiProcessingService,
          useValue: { processPending: jest.fn().mockResolvedValue(okResult) },
        },
        {
          provide: TranslationService,
          useValue: { translatePending: jest.fn().mockResolvedValue(okResult) },
        },
        {
          provide: ModerationService,
          useValue: { approvePending: jest.fn().mockResolvedValue(okResult) },
        },
        {
          provide: PublishingService,
          useValue: { publishPending: jest.fn().mockResolvedValue(okResult) },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
        },
        {
          provide: MetricsService,
          useValue: { observeQueueJob: jest.fn(), updateQueueSize: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def: unknown) => {
              if (key === 'PIPELINE_BATCH_LIMIT') return '25';
              if (key === 'TRANSLATION_TARGET_LANGUAGE') return 'ru';
              return def;
            }),
          },
        },
      ],
    }).compile();

  beforeEach(async () => {
    const module: TestingModule = await moduleRef();
    service = module.get<PipelineService>(PipelineService);
    ingestionService = module.get<IngestionService>(IngestionService);
    aiProcessingService = module.get<AiProcessingService>(AiProcessingService);
    translationService = module.get<TranslationService>(TranslationService);
    moderationService = module.get<ModerationService>(ModerationService);
    publishingService = module.get<PublishingService>(PublishingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should execute all five steps in correct order', async () => {
    const callOrder: string[] = [];
    (ingestionService.ingestFromRss as jest.Mock).mockImplementation(() => {
      callOrder.push('ingestion');
      return Promise.resolve(okResult);
    });
    (aiProcessingService.processPending as jest.Mock).mockImplementation(() => {
      callOrder.push('ai-processing');
      return Promise.resolve(okResult);
    });
    (translationService.translatePending as jest.Mock).mockImplementation(() => {
      callOrder.push('translation');
      return Promise.resolve(okResult);
    });
    (moderationService.approvePending as jest.Mock).mockImplementation(() => {
      callOrder.push('moderation');
      return Promise.resolve(okResult);
    });
    (publishingService.publishPending as jest.Mock).mockImplementation(() => {
      callOrder.push('publishing');
      return Promise.resolve(okResult);
    });

    const result = await service.runFullPipeline();

    expect(result.totalErrors).toBe(0);
    expect(callOrder).toEqual(['ingestion', 'ai-processing', 'translation', 'moderation', 'publishing']);
    expect(result.steps).toHaveLength(5);
    expect(result.steps.map((s: PipelineStepResult) => s.name)).toEqual([
      'ingestion',
      'ai-processing',
      'translation',
      'moderation',
      'publishing',
    ]);
  });

  it('should pass batch limit and target language to steps', async () => {
    await service.runFullPipeline();

    expect(aiProcessingService.processPending).toHaveBeenCalledWith(25);
    expect(translationService.translatePending).toHaveBeenCalledWith(25, 'ru');
    expect(moderationService.approvePending).toHaveBeenCalledWith(25);
    expect(publishingService.publishPending).toHaveBeenCalledWith(25);
  });

  it('should continue remaining pending-based steps when one step throws', async () => {
    (ingestionService.ingestFromRss as jest.Mock).mockRejectedValue(new Error('collector down'));
    (aiProcessingService.processPending as jest.Mock).mockResolvedValue(okResult);
    (translationService.translatePending as jest.Mock).mockResolvedValue(okResult);
    (moderationService.approvePending as jest.Mock).mockResolvedValue(okResult);
    (publishingService.publishPending as jest.Mock).mockResolvedValue(okResult);

    const result = await service.runFullPipeline();

    // Все 5 шагов присутствуют в результате.
    expect(result.steps).toHaveLength(5);
    // Ingestion завершился с ошибкой.
    expect(result.steps[0].ok).toBe(false);
    // Остальные шаги отработали.
    expect(result.steps.slice(1).every((s: PipelineStepResult) => s.ok)).toBe(true);
    // totalErrors учитывает техническую ошибку шага.
    expect(result.totalErrors).toBe(1);
  });

  it('should sum step errors into totalErrors', async () => {
    (ingestionService.ingestFromRss as jest.Mock).mockResolvedValue({ processed: 1, skipped: 0, errors: 2 });
    (aiProcessingService.processPending as jest.Mock).mockResolvedValue(okResult);
    (translationService.translatePending as jest.Mock).mockResolvedValue(okResult);
    (moderationService.approvePending as jest.Mock).mockResolvedValue(okResult);
    (publishingService.publishPending as jest.Mock).mockResolvedValue(okResult);

    const result = await service.runFullPipeline();

    expect(result.totalErrors).toBe(2);
    expect(result.steps[0].ok).toBe(true);
  });
});