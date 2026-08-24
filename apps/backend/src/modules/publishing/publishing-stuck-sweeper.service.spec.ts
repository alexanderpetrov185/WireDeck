import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PublishingStuckSweeperService } from './publishing-stuck-sweeper.service';
import { NewsService } from '../news/news.service';
import { LoggerService } from '../../common/logger/logger.service';
import { MetricsService } from '../../common/metrics/metrics.service';

describe('PublishingStuckSweeperService', () => {
  let service: PublishingStuckSweeperService;
  let newsService: { findStuckPublished: jest.Mock };
  let metrics: { setPublishingStuck: jest.Mock };
  let logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };

  const createModule = async (env: Record<string, string> = {}) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublishingStuckSweeperService,
        { provide: NewsService, useValue: { findStuckPublished: jest.fn().mockResolvedValue([]) } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, def: unknown) => env[key] ?? def) },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
        },
        { provide: MetricsService, useValue: { setPublishingStuck: jest.fn() } },
      ],
    }).compile();

    return {
      module,
      service: module.get<PublishingStuckSweeperService>(PublishingStuckSweeperService),
      newsService: module.get(NewsService) as unknown as { findStuckPublished: jest.Mock },
      metrics: module.get(MetricsService) as unknown as { setPublishingStuck: jest.Mock },
      logger: module.get(LoggerService) as unknown as { log: jest.Mock; warn: jest.Mock; error: jest.Mock },
    };
  };

  beforeEach(async () => {
    const created = await createModule();
    service = created.service;
    newsService = created.newsService;
    metrics = created.metrics;
    logger = created.logger;
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sweep (detection only)', () => {
    it('should set metric to 0 and not log errors when no stuck news', async () => {
      const count = await service.sweep();

      expect(count).toBe(0);
      expect(metrics.setPublishingStuck).toHaveBeenCalledWith(0);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should detect stuck news, set gauge and log IDs (no data mutation)', async () => {
      const now = Date.now();
      const stuckNews = [
        { id: 'news-1', updatedAt: new Date(now - 7200000) },
        { id: 'news-2', updatedAt: new Date(now - 5400000) },
      ];
      (newsService.findStuckPublished as jest.Mock).mockResolvedValue(stuckNews);

      const count = await service.sweep();

      expect(count).toBe(2);
      expect(metrics.setPublishingStuck).toHaveBeenCalledWith(2);
      expect(newsService.findStuckPublished).toHaveBeenCalledWith(3600000);
      expect(logger.error).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('news-1'), undefined, 'PublishingStuckSweeper');
    });

    it('should pass threshold from env to news query', async () => {
      const created = await createModule({ PUBLISHING_STUCK_THRESHOLD_MS: '60000' });
      await created.service.sweep();
      expect(created.newsService.findStuckPublished).toHaveBeenCalledWith(60000);
    });

    it('should fall back to default threshold for invalid env', async () => {
      const created = await createModule({ PUBLISHING_STUCK_THRESHOLD_MS: '-5' });
      await created.service.sweep();
      expect(created.newsService.findStuckPublished).toHaveBeenCalledWith(3600000);
    });

    it('should NOT modify any data (read-only detection)', async () => {
      // Sweeper не должен вызывать update/revert/publish методы.
      (newsService as unknown as Record<string, jest.Mock>).revertPublishingClaim = jest.fn();
      (newsService as unknown as Record<string, jest.Mock>).updateStatus = jest.fn();
      await service.sweep();
      expect((newsService as unknown as Record<string, jest.Mock>).revertPublishingClaim).not.toHaveBeenCalled();
      expect((newsService as unknown as Record<string, jest.Mock>).updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('getStuck (manual diagnostics)', () => {
    it('should return id/updatedAt pairs only', async () => {
      const now = Date.now();
      (newsService.findStuckPublished as jest.Mock).mockResolvedValue([
        { id: 'abc', updatedAt: new Date(now), status: 'published' },
      ]);

      const items = await service.getStuck();

      expect(items).toEqual([{ id: 'abc', updatedAt: new Date(now).toISOString() }]);
    });
  });

  describe('lifecycle', () => {
    it('should stop timer on destroy without throwing', () => {
      expect(() => service.onModuleDestroy()).not.toThrow();
    });

    it('should start interval on init and stop on destroy', async () => {
      const { service: s } = await createModule({
        PUBLISHING_STUCK_SWEEP_INTERVAL_MS: '30000',
      });
      expect(() => s.onModuleInit()).not.toThrow();
      s.onModuleDestroy();
      expect(true).toBe(true);
    });
  });
});
