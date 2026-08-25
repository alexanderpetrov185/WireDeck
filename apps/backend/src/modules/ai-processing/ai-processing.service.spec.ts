import { Test, TestingModule } from '@nestjs/testing';
import { AiProcessingService } from './ai-processing.service';
import { NewsService } from '../news/news.service';
import { AiProvider } from './ai-provider.interface';
import { LoggerService } from '../../common/logger/logger.service';
import { AI_PROVIDER } from './ai-provider.token';
import { NewsStatus } from '../news/entities/news.entity';
import { RateLimitError } from '../../common/rate-limit/rate-limited.client';

describe('AiProcessingService (rate limit handling)', () => {
  let service: AiProcessingService;
  let newsService: { findById: jest.Mock; findByStatus: jest.Mock; update: jest.Mock };
  let aiProvider: { summarize: jest.Mock };
  let logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock; debug: jest.Mock };

  const mockNews = (id: string) => ({
    id,
    rawText: 'Some raw text',
    status: NewsStatus.RAW,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiProcessingService,
        {
          provide: NewsService,
          useValue: { findById: jest.fn(), findByStatus: jest.fn(), update: jest.fn() },
        },
        {
          provide: AI_PROVIDER,
          useValue: { summarize: jest.fn() },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AiProcessingService>(AiProcessingService);
    newsService = module.get(NewsService);
    aiProvider = module.get(AI_PROVIDER);
    logger = module.get(LoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should defer remaining batch items as skipped on rate limit', async () => {
    const items = [mockNews('n1'), mockNews('n2'), mockNews('n3'), mockNews('n4')];
    (newsService.findByStatus as jest.Mock).mockResolvedValue(items);

    // Первая новость успешно обрабатывается, вторая — упорный rate limit.
    (aiProvider.summarize as jest.Mock)
      .mockResolvedValueOnce({ summary: 's', importance: 0.5, category: 'news' })
      .mockRejectedValue(new RateLimitError());
    (newsService.findById as jest.Mock).mockImplementation(async (id: string) => mockNews(id));
    (newsService.update as jest.Mock).mockResolvedValue({});

    const result = await service.processPending(10);

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);
    // n2 вызвала rate limit, n3+n4 отложены.
    expect(result.skipped).toBe(3);
    expect(aiProvider.summarize).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('deferring 3'),
      'AiProcessingService',
    );
  });

  it('should count plain provider errors as errors and continue the batch', async () => {
    const items = [mockNews('n1'), mockNews('n2')];
    (newsService.findByStatus as jest.Mock).mockResolvedValue(items);
    (aiProvider.summarize as jest.Mock)
      .mockRejectedValueOnce(new Error('AI provider error: boom'))
      .mockResolvedValueOnce({ summary: 's', importance: 0.5, category: 'news' });
    (newsService.findById as jest.Mock).mockImplementation(async (id: string) => mockNews(id));
    (newsService.update as jest.Mock).mockResolvedValue({});

    const result = await service.processPending(10);

    expect(result).toEqual({ processed: 1, skipped: 0, errors: 1 });
    expect(aiProvider.summarize).toHaveBeenCalledTimes(2);
  });

  it('should not mark deferred news as processed in DB', async () => {
    const items = [mockNews('n1'), mockNews('n2')];
    (newsService.findByStatus as jest.Mock).mockResolvedValue(items);
    (aiProvider.summarize as jest.Mock).mockRejectedValue(new RateLimitError());
    (newsService.findById as jest.Mock).mockImplementation(async (id: string) => mockNews(id));

    await service.processPending(10);

    expect(newsService.update).not.toHaveBeenCalled();
  });
});