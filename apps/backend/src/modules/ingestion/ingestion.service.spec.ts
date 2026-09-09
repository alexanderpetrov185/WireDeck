import { Test, TestingModule } from '@nestjs/testing';
import { IngestionService } from './ingestion.service';
import { CollectorService } from '../collector/collector.service';
import { NewsService } from '../news/news.service';
import { LoggerService } from '../../common/logger/logger.service';
import { SourceTiersService } from './source-tiers.service';
import { NewsSource } from '../news/constants/news-source.enum';
import { NewsLanguage } from '../news/constants/news-language.enum';
import { CollectedNews } from '../collector/interfaces/collected-news.interface';

describe('IngestionService', () => {
  let service: IngestionService;
  let collectorService: CollectorService;
  let newsService: NewsService;
  let loggerService: LoggerService;
  let tiersResolve: jest.Mock;

  const mockCollectedNews: CollectedNews[] = [
    {
      sourceId: 'rss-1',
      source: NewsSource.RSS,
      sourceName: 'Test Feed',
      author: 'Author 1',
      sourceUrl: 'https://test.com/1',
      rawText: 'Content 1',
      sourceLanguage: NewsLanguage.EN,
      category: 'Business',
      publishedAt: new Date('2026-08-11T10:00:00Z'),
    },
    {
      sourceId: 'rss-2',
      source: NewsSource.RSS,
      sourceName: 'Test Feed',
      author: null,
      sourceUrl: 'https://test.com/2',
      rawText: 'Content 2',
      sourceLanguage: NewsLanguage.EN,
      category: null,
      publishedAt: new Date('2026-08-11T11:00:00Z'),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: CollectorService,
          useValue: {
            collectFrom: jest.fn(),
          },
        },
        {
          provide: NewsService,
          useValue: {
            findByHash: jest.fn(),
            findBySource: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          // Sprint 22b: tier default 2 (config disabled).
          provide: SourceTiersService,
          useValue: { resolve: jest.fn().mockReturnValue(2) },
        },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
    collectorService = module.get<CollectorService>(CollectorService);
    newsService = module.get<NewsService>(NewsService);
    loggerService = module.get<LoggerService>(LoggerService);
    tiersResolve = (module.get(SourceTiersService) as { resolve: jest.Mock }).resolve;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should successfully save collected news', async () => {
    (collectorService.collectFrom as jest.Mock).mockResolvedValue(mockCollectedNews);
    (newsService.findByHash as jest.Mock).mockResolvedValue(null);
    (newsService.findBySource as jest.Mock).mockResolvedValue(null);
    (newsService.create as jest.Mock).mockResolvedValue({ id: 'uuid-1' });

    const result = await service.ingestFromRss();

    expect(result).toEqual({
      collected: 2,
      saved: 2,
      skipped: 0,
      errors: 0,
    });
    expect(newsService.create).toHaveBeenCalledTimes(2);
    expect(loggerService.log).toHaveBeenCalledWith(
      expect.stringContaining('Collected: 2, Saved: 2, Skipped: 0, Errors: 0'),
      expect.any(String),
    );
  });

  it('persists sourceTier resolved from SourceTiersService (Sprint 22b)', async () => {
    tiersResolve.mockReturnValue(1);
    (collectorService.collectFrom as jest.Mock).mockResolvedValue([mockCollectedNews[0]]);
    (newsService.findByHash as jest.Mock).mockResolvedValue(null);
    (newsService.findBySource as jest.Mock).mockResolvedValue(null);
    (newsService.create as jest.Mock).mockResolvedValue({ id: 'uuid-1' });

    await service.ingestFromRss();

    expect(tiersResolve).toHaveBeenCalledWith('Test Feed');
    expect(newsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ sourceName: 'Test Feed', sourceTier: 1 }),
    );
  });

  it('should handle empty collector result', async () => {
    (collectorService.collectFrom as jest.Mock).mockResolvedValue([]);

    const result = await service.ingestFromRss();

    expect(result).toEqual({
      collected: 0,
      saved: 0,
      skipped: 0,
      errors: 0,
    });
    expect(newsService.create).not.toHaveBeenCalled();
  });

  it('should handle collector error gracefully', async () => {
    (collectorService.collectFrom as jest.Mock).mockRejectedValue(new Error('Network failure'));

    const result = await service.ingestFromRss();

    expect(result).toEqual({
      collected: 0,
      saved: 0,
      skipped: 0,
      errors: 1,
    });
    expect(loggerService.error).toHaveBeenCalledWith(
      expect.stringContaining('Collector failed'),
      expect.any(String),
      expect.any(String),
    );
  });

  it('should handle save error for one item without failing others', async () => {
    (collectorService.collectFrom as jest.Mock).mockResolvedValue(mockCollectedNews);
    (newsService.findByHash as jest.Mock).mockResolvedValue(null);
    (newsService.findBySource as jest.Mock).mockResolvedValue(null);
    (newsService.create as jest.Mock)
      .mockRejectedValueOnce(new Error('DB constraint violation'))
      .mockResolvedValueOnce({ id: 'uuid-2' });

    const result = await service.ingestFromRss();

    expect(result).toEqual({
      collected: 2,
      saved: 1,
      skipped: 0,
      errors: 1,
    });
    expect(newsService.create).toHaveBeenCalledTimes(2);
    expect(loggerService.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to save news item'),
      expect.any(String),
      expect.any(String),
    );
  });

  it('should skip duplicate news by hash', async () => {
    (collectorService.collectFrom as jest.Mock).mockResolvedValue(mockCollectedNews);
    (newsService.findByHash as jest.Mock).mockResolvedValue({ id: 'existing-1' });

    const result = await service.ingestFromRss();

    expect(result).toEqual({
      collected: 2,
      saved: 0,
      skipped: 2,
      errors: 0,
    });
    expect(newsService.create).not.toHaveBeenCalled();
  });

  it('should skip duplicate news by sourceId', async () => {
    (collectorService.collectFrom as jest.Mock).mockResolvedValue(mockCollectedNews);
    (newsService.findByHash as jest.Mock).mockResolvedValue(null);
    (newsService.findBySource as jest.Mock).mockResolvedValue({ id: 'existing-2' });

    const result = await service.ingestFromRss();

    expect(result).toEqual({
      collected: 2,
      saved: 0,
      skipped: 2,
      errors: 0,
    });
    expect(newsService.create).not.toHaveBeenCalled();
  });

  it('should not create duplicates on repeated ingestion', async () => {
    // Первый запуск: все сохраняются
    (collectorService.collectFrom as jest.Mock).mockResolvedValue(mockCollectedNews);
    (newsService.findByHash as jest.Mock).mockResolvedValue(null);
    (newsService.findBySource as jest.Mock).mockResolvedValue(null);
    (newsService.create as jest.Mock).mockResolvedValue({ id: 'uuid-1' });

    const firstRun = await service.ingestFromRss();
    expect(firstRun).toEqual({ collected: 2, saved: 2, skipped: 0, errors: 0 });

    // Второй запуск: все уже существуют (findByHash возвращает запись)
    (newsService.findByHash as jest.Mock).mockResolvedValue({ id: 'existing-hash' });

    const secondRun = await service.ingestFromRss();
    expect(secondRun).toEqual({ collected: 2, saved: 0, skipped: 2, errors: 0 });
    expect(newsService.create).toHaveBeenCalledTimes(2); // только первый раз
  });

  it('should deduplicate by normalized hash (same text, different HTML/whitespace)', async () => {
    const news1: CollectedNews = { ...mockCollectedNews[0], rawText: '<p>Hello <b>World</b></p>' };
    const news2: CollectedNews = { ...mockCollectedNews[1], rawText: '  hello   world  ' };

    (collectorService.collectFrom as jest.Mock).mockResolvedValue([news1, news2]);
    // Первый вызов findByHash (для news1) → null (не существует)
    // Второй вызов findByHash (для news2, тот же hash) → существующая запись
    (newsService.findByHash as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing-hash' });
    (newsService.findBySource as jest.Mock).mockResolvedValue(null);
    (newsService.create as jest.Mock).mockResolvedValue({ id: 'uuid-1' });

    const result = await service.ingestFromRss();

    // Оба текста нормализуются к одному hash → вторая запись будет пропущена
    expect(result).toEqual({ collected: 2, saved: 1, skipped: 1, errors: 0 });
    expect(newsService.create).toHaveBeenCalledTimes(1);
  });
});
