import { Test, TestingModule } from '@nestjs/testing';
import { ModerationService } from './moderation.service';
import { NewsService } from '../news/news.service';
import { LoggerService } from '../../common/logger/logger.service';
import { NewsStatus } from '../news/entities/news.entity';

describe('ModerationService', () => {
  let service: ModerationService;
  let newsService: NewsService;
  let loggerService: LoggerService;

  const mockNews = (overrides: Partial<any> = {}) => ({
    id: 'uuid-1',
    sourceId: 'rss-1',
    source: 'rss',
    sourceUrl: 'https://test.com/1',
    sourceName: 'Test Feed',
    author: 'Author 1',
    rawText: 'Original text content',
    sourceLanguage: 'en',
    status: NewsStatus.QUEUED,
    title: 'Test Title',
    summary: 'This is a summary of the news article.',
    translatedText: 'Translated text',
    importance: 0.8,
    category: 'business',
    hash: 'abc123',
    duplicateOf: null,
    telegramMessageId: null,
    moderatedBy: null,
    moderatedAt: null,
    rejectionReason: null,
    publishedAt: new Date('2026-08-11T10:00:00Z'),
    createdAt: new Date('2026-08-11T10:00:00Z'),
    updatedAt: new Date('2026-08-11T10:00:00Z'),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        {
          provide: NewsService,
          useValue: {
            findById: jest.fn(),
            findByStatus: jest.fn(),
            update: jest.fn(),
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

    service = module.get<ModerationService>(ModerationService);
    newsService = module.get<NewsService>(NewsService);
    loggerService = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('approveOne', () => {
    it('should successfully approve a queued news', async () => {
      const news = mockNews({ status: NewsStatus.QUEUED });
      (newsService.findById as jest.Mock).mockResolvedValue(news);
      (newsService.update as jest.Mock).mockResolvedValue({
        ...news,
        status: NewsStatus.APPROVED,
        moderatedBy: 'moderator-1',
        moderatedAt: expect.any(Date),
      });

      const result = await service.approveOne('uuid-1', 'moderator-1');

      expect(result).toEqual({ processed: 1, skipped: 0, errors: 0 });
      expect(newsService.update).toHaveBeenCalledWith('uuid-1', {
        status: NewsStatus.APPROVED,
        moderatedBy: 'moderator-1',
        moderatedAt: expect.any(Date),
      });
    });

    it('should skip already approved news', async () => {
      const news = mockNews({ status: NewsStatus.APPROVED });
      (newsService.findById as jest.Mock).mockResolvedValue(news);

      const result = await service.approveOne('uuid-1', 'moderator-1');

      expect(result).toEqual({ processed: 0, skipped: 1, errors: 0 });
      expect(newsService.update).not.toHaveBeenCalled();
    });

    it('should reject invalid status transition (e.g. RAW)', async () => {
      const news = mockNews({ status: NewsStatus.RAW });
      (newsService.findById as jest.Mock).mockResolvedValue(news);

      const result = await service.approveOne('uuid-1', 'moderator-1');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(newsService.update).not.toHaveBeenCalled();
      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('cannot approve'),
        expect.any(String),
      );
    });

    it('should reject invalid status transition (e.g. TRANSLATED)', async () => {
      const news = mockNews({ status: NewsStatus.TRANSLATED });
      (newsService.findById as jest.Mock).mockResolvedValue(news);

      const result = await service.approveOne('uuid-1', 'moderator-1');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(newsService.update).not.toHaveBeenCalled();
    });

    it('should handle news not found', async () => {
      (newsService.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.approveOne('nonexistent', 'moderator-1');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(newsService.update).not.toHaveBeenCalled();
    });

    it('should handle missing moderator', async () => {
      const result = await service.approveOne('uuid-1', '');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(newsService.findById).not.toHaveBeenCalled();
    });

    it('should handle DB update error', async () => {
      const news = mockNews({ status: NewsStatus.QUEUED });
      (newsService.findById as jest.Mock).mockResolvedValue(news);
      (newsService.update as jest.Mock).mockRejectedValue(new Error('DB write failed'));

      const result = await service.approveOne('uuid-1', 'moderator-1');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(loggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to approve news uuid-1'),
        expect.any(String),
        expect.any(String),
      );
    });
  });

  describe('rejectOne', () => {
    it('should successfully reject a queued news', async () => {
      const news = mockNews({ status: NewsStatus.QUEUED });
      (newsService.findById as jest.Mock).mockResolvedValue(news);
      (newsService.update as jest.Mock).mockResolvedValue({
        ...news,
        status: NewsStatus.REJECTED,
        moderatedBy: 'moderator-1',
        moderatedAt: expect.any(Date),
        rejectionReason: 'Spam',
      });

      const result = await service.rejectOne('uuid-1', 'moderator-1', 'Spam');

      expect(result).toEqual({ processed: 1, skipped: 0, errors: 0 });
      expect(newsService.update).toHaveBeenCalledWith('uuid-1', {
        status: NewsStatus.REJECTED,
        moderatedBy: 'moderator-1',
        moderatedAt: expect.any(Date),
        rejectionReason: 'Spam',
      });
    });

    it('should reject without reason', async () => {
      const result = await service.rejectOne('uuid-1', 'moderator-1', '');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(newsService.findById).not.toHaveBeenCalled();
      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Reject reason is required'),
        expect.any(String),
      );
    });

    it('should skip already rejected news', async () => {
      const news = mockNews({ status: NewsStatus.REJECTED });
      (newsService.findById as jest.Mock).mockResolvedValue(news);

      const result = await service.rejectOne('uuid-1', 'moderator-1', 'Spam');

      expect(result).toEqual({ processed: 0, skipped: 1, errors: 0 });
      expect(newsService.update).not.toHaveBeenCalled();
    });

    it('should reject invalid status transition (e.g. PUBLISHED)', async () => {
      const news = mockNews({ status: NewsStatus.PUBLISHED });
      (newsService.findById as jest.Mock).mockResolvedValue(news);

      const result = await service.rejectOne('uuid-1', 'moderator-1', 'Spam');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(newsService.update).not.toHaveBeenCalled();
      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('cannot reject'),
        expect.any(String),
      );
    });

    it('should handle DB update error', async () => {
      const news = mockNews({ status: NewsStatus.QUEUED });
      (newsService.findById as jest.Mock).mockResolvedValue(news);
      (newsService.update as jest.Mock).mockRejectedValue(new Error('DB write failed'));

      const result = await service.rejectOne('uuid-1', 'moderator-1', 'Spam');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(loggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to reject news uuid-1'),
        expect.any(String),
        expect.any(String),
      );
    });
  });

  describe('approvePending', () => {
    it('should approve all queued news in batch', async () => {
      const news1 = mockNews({ id: 'uuid-1', status: NewsStatus.QUEUED });
      const news2 = mockNews({ id: 'uuid-2', status: NewsStatus.QUEUED });
      (newsService.findByStatus as jest.Mock).mockResolvedValue([news1, news2]);
      (newsService.findById as jest.Mock)
        .mockResolvedValueOnce(news1)
        .mockResolvedValueOnce(news2);
      (newsService.update as jest.Mock).mockResolvedValue({});

      const result = await service.approvePending(50);

      expect(result).toEqual({ processed: 2, skipped: 0, errors: 0 });
      expect(newsService.findByStatus).toHaveBeenCalledWith(NewsStatus.QUEUED, 50);
      expect(newsService.update).toHaveBeenCalledTimes(2);
    });

    it('should not break batch when one news fails', async () => {
      const news1 = mockNews({ id: 'uuid-1', status: NewsStatus.QUEUED });
      const news2 = mockNews({ id: 'uuid-2', status: NewsStatus.QUEUED });
      const news3 = mockNews({ id: 'uuid-3', status: NewsStatus.QUEUED });
      (newsService.findByStatus as jest.Mock).mockResolvedValue([news1, news2, news3]);
      (newsService.findById as jest.Mock)
        .mockResolvedValueOnce(news1)
        .mockResolvedValueOnce(news2)
        .mockResolvedValueOnce(news3);
      (newsService.update as jest.Mock)
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('DB failure'))
        .mockResolvedValueOnce({});

      const result = await service.approvePending(50);

      expect(result).toEqual({ processed: 2, skipped: 0, errors: 1 });
      expect(newsService.update).toHaveBeenCalledTimes(3);
    });

    it('should handle empty batch', async () => {
      (newsService.findByStatus as jest.Mock).mockResolvedValue([]);

      const result = await service.approvePending(50);

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 0 });
      expect(newsService.update).not.toHaveBeenCalled();
    });
  });
});