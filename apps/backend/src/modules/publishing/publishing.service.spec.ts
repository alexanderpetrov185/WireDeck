import { Test, TestingModule } from '@nestjs/testing';
import { PublishingService } from './publishing.service';
import { NewsService } from '../news/news.service';
import { Publisher } from './providers/publisher.interface';
import { PUBLISHER_TOKEN } from './providers/publisher.token';
import { LoggerService } from '../../common/logger/logger.service';
import { NewsStatus } from '../news/entities/news.entity';

describe('PublishingService', () => {
  let service: PublishingService;
  let newsService: NewsService;
  let publisher: Publisher;

  const mockNews = (overrides: Partial<any> = {}) => ({
    id: 'uuid-1',
    sourceId: 'rss-1',
    source: 'rss',
    sourceUrl: 'https://test.com/1',
    sourceName: 'Test Feed',
    author: 'Author 1',
    rawText: 'Original text content',
    sourceLanguage: 'en',
    status: NewsStatus.APPROVED,
    title: 'Test Title',
    summary: 'This is a summary of the news article.',
    translatedText: 'Translated text content',
    importance: 0.8,
    category: 'business',
    hash: 'abc123',
    duplicateOf: null,
    telegramMessageId: null,
    moderatedBy: 'moderator-1',
    moderatedAt: new Date('2026-08-11T10:00:00Z'),
    rejectionReason: null,
    publishedAt: new Date('2026-08-11T10:00:00Z'),
    createdAt: new Date('2026-08-11T10:00:00Z'),
    updatedAt: new Date('2026-08-11T10:00:00Z'),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublishingService,
        {
          provide: NewsService,
          useValue: {
            findById: jest.fn(),
            findByStatus: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: PUBLISHER_TOKEN,
          useValue: {
            publish: jest.fn(),
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
      ],
    }).compile();

    service = module.get<PublishingService>(PublishingService);
    newsService = module.get<NewsService>(NewsService);
    publisher = module.get(PUBLISHER_TOKEN);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishOne', () => {
    it('should successfully publish APPROVED news to Telegram and update status', async () => {
      const news = mockNews({ status: NewsStatus.APPROVED });
      (newsService.findById as jest.Mock).mockResolvedValue(news);
      (publisher.publish as jest.Mock).mockResolvedValue('123456');
      (newsService.update as jest.Mock).mockResolvedValue({
        ...news,
        status: NewsStatus.PUBLISHED,
        telegramMessageId: '123456',
      });

      const result = await service.publishOne('uuid-1');

      expect(result).toEqual({ processed: 1, skipped: 0, errors: 0 });
      expect(publisher.publish).toHaveBeenCalledWith(
        expect.stringContaining('Translated text content'),
      );
      expect(newsService.update).toHaveBeenCalledWith('uuid-1', {
        status: NewsStatus.PUBLISHED,
        telegramMessageId: '123456',
      });
    });

    it('should skip already PUBLISHED news (idempotency)', async () => {
      const news = mockNews({ status: NewsStatus.PUBLISHED, telegramMessageId: '123456' });
      (newsService.findById as jest.Mock).mockResolvedValue(news);

      const result = await service.publishOne('uuid-1');

      expect(result).toEqual({ processed: 0, skipped: 1, errors: 0 });
      expect(publisher.publish).not.toHaveBeenCalled();
      expect(newsService.update).not.toHaveBeenCalled();
    });

    it('should reject invalid status transitions (e.g. RAW)', async () => {
      const news = mockNews({ status: NewsStatus.RAW });
      (newsService.findById as jest.Mock).mockResolvedValue(news);

      const result = await service.publishOne('uuid-1');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(publisher.publish).not.toHaveBeenCalled();
      expect(newsService.update).not.toHaveBeenCalled();
    });

    it('should reject invalid status transitions (e.g. QUEUED)', async () => {
      const news = mockNews({ status: NewsStatus.QUEUED });
      (newsService.findById as jest.Mock).mockResolvedValue(news);

      const result = await service.publishOne('uuid-1');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(publisher.publish).not.toHaveBeenCalled();
    });

    it('should handle news not found', async () => {
      (newsService.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.publishOne('nonexistent');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(publisher.publish).not.toHaveBeenCalled();
    });

    it('should handle Telegram API failures gracefully', async () => {
      const news = mockNews({ status: NewsStatus.APPROVED });
      (newsService.findById as jest.Mock).mockResolvedValue(news);
      (publisher.publish as jest.Mock).mockRejectedValue(new Error('Network Error'));

      const result = await service.publishOne('uuid-1');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(newsService.update).not.toHaveBeenCalled();
    });
  });

  describe('publishPending', () => {
    it('should publish all approved news in batch', async () => {
      const news1 = mockNews({ id: 'uuid-1', status: NewsStatus.APPROVED });
      const news2 = mockNews({ id: 'uuid-2', status: NewsStatus.APPROVED });
      (newsService.findByStatus as jest.Mock).mockResolvedValue([news1, news2]);
      (newsService.findById as jest.Mock)
        .mockResolvedValueOnce(news1)
        .mockResolvedValueOnce(news2);
      (publisher.publish as jest.Mock).mockResolvedValue('11111');
      (newsService.update as jest.Mock).mockResolvedValue({});

      const result = await service.publishPending(50);

      expect(result).toEqual({ processed: 2, skipped: 0, errors: 0 });
      expect(newsService.findByStatus).toHaveBeenCalledWith(NewsStatus.APPROVED, 50);
      expect(publisher.publish).toHaveBeenCalledTimes(2);
    });

    it('should continue processing the batch if one news fails (batch failure isolation)', async () => {
      const news1 = mockNews({ id: 'uuid-1', status: NewsStatus.APPROVED });
      const news2 = mockNews({ id: 'uuid-2', status: NewsStatus.APPROVED });
      const news3 = mockNews({ id: 'uuid-3', status: NewsStatus.APPROVED });
      (newsService.findByStatus as jest.Mock).mockResolvedValue([news1, news2, news3]);
      (newsService.findById as jest.Mock)
        .mockResolvedValueOnce(news1)
        .mockResolvedValueOnce(news2)
        .mockResolvedValueOnce(news3);

      (publisher.publish as jest.Mock)
        .mockResolvedValueOnce('11111')
        .mockRejectedValueOnce(new Error('Telegram error'))
        .mockResolvedValueOnce('33333');

      const result = await service.publishPending(50);

      expect(result).toEqual({ processed: 2, skipped: 0, errors: 1 });
      expect(publisher.publish).toHaveBeenCalledTimes(3);
    });

    it('should handle empty batch', async () => {
      (newsService.findByStatus as jest.Mock).mockResolvedValue([]);

      const result = await service.publishPending(50);

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 0 });
      expect(publisher.publish).not.toHaveBeenCalled();
    });
  });
});
