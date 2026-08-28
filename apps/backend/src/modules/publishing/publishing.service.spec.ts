import { Test, TestingModule } from '@nestjs/testing';
import { PublishingService } from './publishing.service';
import { NewsService } from '../news/news.service';
import { Publisher } from './providers/publisher.interface';
import { PUBLISHER_TOKEN } from './providers/publisher.token';
import { LoggerService } from '../../common/logger/logger.service';
import { NewsStatus } from '../news/entities/news.entity';
import { ComplianceService } from '../compliance/compliance.service';
import { ConfigService } from '@nestjs/config';

describe('PublishingService', () => {
  let service: PublishingService;
  let newsService: NewsService;
  let publisher: Publisher;
  let complianceService: { scan: jest.Mock };

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
            claimForPublishing: jest.fn(),
            markPublished: jest.fn(),
            revertPublishingClaim: jest.fn(),
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
        {
          // По умолчанию compliance выключен (scan → clean).
          provide: ComplianceService,
          useValue: { scan: jest.fn().mockReturnValue({ labels: [], footnotes: [], blocked: false, matches: [] }) },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'PUBLISH_DELAY_MS') return '0'; // no delay in tests
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PublishingService>(PublishingService);
    newsService = module.get<NewsService>(NewsService);
    publisher = module.get(PUBLISHER_TOKEN);
    complianceService = module.get(ComplianceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishOne', () => {
    it('should successfully publish APPROVED news to Telegram and update status', async () => {
      const news = mockNews({ status: NewsStatus.APPROVED });
      (newsService.claimForPublishing as jest.Mock).mockResolvedValue(true);
      (newsService.findById as jest.Mock).mockResolvedValue(news);
      (publisher.publish as jest.Mock).mockResolvedValue('123456');
      (newsService.markPublished as jest.Mock).mockResolvedValue(true);

      const result = await service.publishOne('uuid-1');

      expect(result).toEqual({ processed: 1, skipped: 0, errors: 0 });
      expect(newsService.claimForPublishing).toHaveBeenCalledWith('uuid-1');
      // Sprint 13: publish path использует общий formatter.
      expect(publisher.publish).toHaveBeenCalledWith(
        'Test Title\n\nTranslated text content\n\nSource: Test Feed — https://test.com/1\n\n#business',
      );
      expect(newsService.markPublished).toHaveBeenCalledWith('uuid-1', '123456');
    });

    it('should never send raw text sheet to Telegram (formatter fallback)', async () => {
      const news = mockNews({ status: NewsStatus.APPROVED, translatedText: null, summary: null, rawText: 'raw '.repeat(3000) });
      (newsService.claimForPublishing as jest.Mock).mockResolvedValue(true);
      (newsService.findById as jest.Mock).mockResolvedValue(news);
      (publisher.publish as jest.Mock).mockResolvedValue('123456');
      (newsService.markPublished as jest.Mock).mockResolvedValue(true);

      await service.publishOne('uuid-1');

      const sent = (publisher.publish as jest.Mock).mock.calls[0][0] as string;
      expect(sent.length).toBeLessThanOrEqual(3900);
      expect(sent).toContain('Source: Test Feed — https://test.com/1');
    });

    it('should block autopublish on compliance block match (Sprint 19)', async () => {
      const news = mockNews({ status: NewsStatus.APPROVED });
      (newsService.claimForPublishing as jest.Mock).mockResolvedValue(true);
      (newsService.findById as jest.Mock).mockResolvedValue(news);
      (complianceService.scan as jest.Mock).mockReturnValue({
        labels: ['terror_extremist'],
        footnotes: [],
        blocked: true,
        matches: [{ category: 'terror_extremist', action: 'block', term: 'Example Extremist Org' }],
      });

      const result = await service.publishOne('uuid-1');

      // Не публикуем, claim откатываем, labels сохранены.
      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(publisher.publish).not.toHaveBeenCalled();
      expect(newsService.revertPublishingClaim).toHaveBeenCalledWith('uuid-1');
      expect(newsService.update).toHaveBeenCalledWith('uuid-1', { complianceLabels: 'terror_extremist' });
      expect(newsService.markPublished).not.toHaveBeenCalled();
    });

    it('should append compliance footnote and persist label on label match (Sprint 19)', async () => {
      const news = mockNews({ status: NewsStatus.APPROVED });
      (newsService.claimForPublishing as jest.Mock).mockResolvedValue(true);
      (newsService.findById as jest.Mock).mockResolvedValue(news);
      (publisher.publish as jest.Mock).mockResolvedValue('123456');
      (newsService.markPublished as jest.Mock).mockResolvedValue(true);
      (complianceService.scan as jest.Mock).mockReturnValue({
        labels: ['foreign_agent'],
        footnotes: ['FA footnote text.'],
        blocked: false,
        matches: [{ category: 'foreign_agent', action: 'label', term: 'Example Foreign Agent Name' }],
      });

      const result = await service.publishOne('uuid-1');

      expect(result).toEqual({ processed: 1, skipped: 0, errors: 0 });
      // Labels сохранены ДО отправки.
      expect(newsService.update).toHaveBeenCalledWith('uuid-1', { complianceLabels: 'foreign_agent' });
      // Сноска в конце поста.
      const sent = (publisher.publish as jest.Mock).mock.calls[0][0] as string;
      expect(sent.endsWith('FA footnote text.')).toBe(true);
      expect(sent).toContain('\n\nFA footnote text.');
      expect(newsService.markPublished).toHaveBeenCalledWith('uuid-1', '123456');
    });

    it('should not persist labels when scan is clean (Sprint 19)', async () => {
      const news = mockNews({ status: NewsStatus.APPROVED });
      (newsService.claimForPublishing as jest.Mock).mockResolvedValue(true);
      (newsService.findById as jest.Mock).mockResolvedValue(news);
      (publisher.publish as jest.Mock).mockResolvedValue('123456');
      (newsService.markPublished as jest.Mock).mockResolvedValue(true);

      await service.publishOne('uuid-1');

      expect(newsService.update).not.toHaveBeenCalled();
    });

    it('should skip already PUBLISHED news (idempotency)', async () => {
      const news = mockNews({ status: NewsStatus.PUBLISHED, telegramMessageId: '123456' });
      (newsService.claimForPublishing as jest.Mock).mockResolvedValue(false);
      (newsService.findById as jest.Mock).mockResolvedValue(news);

      const result = await service.publishOne('uuid-1');

      expect(result).toEqual({ processed: 0, skipped: 1, errors: 0 });
      expect(publisher.publish).not.toHaveBeenCalled();
      expect(newsService.markPublished).not.toHaveBeenCalled();
    });

    it('should reject invalid status transitions (e.g. RAW)', async () => {
      const news = mockNews({ status: NewsStatus.RAW });
      (newsService.claimForPublishing as jest.Mock).mockResolvedValue(false);
      (newsService.findById as jest.Mock).mockResolvedValue(news);

      const result = await service.publishOne('uuid-1');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(publisher.publish).not.toHaveBeenCalled();
      expect(newsService.markPublished).not.toHaveBeenCalled();
    });

    it('should reject invalid status transitions (e.g. QUEUED)', async () => {
      const news = mockNews({ status: NewsStatus.QUEUED });
      (newsService.claimForPublishing as jest.Mock).mockResolvedValue(false);
      (newsService.findById as jest.Mock).mockResolvedValue(news);

      const result = await service.publishOne('uuid-1');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(publisher.publish).not.toHaveBeenCalled();
    });

    it('should handle news not found', async () => {
      (newsService.claimForPublishing as jest.Mock).mockResolvedValue(false);
      (newsService.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.publishOne('nonexistent');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(publisher.publish).not.toHaveBeenCalled();
    });

    it('should handle Telegram API failures gracefully and revert claim', async () => {
      const news = mockNews({ status: NewsStatus.APPROVED });
      (newsService.claimForPublishing as jest.Mock).mockResolvedValue(true);
      (newsService.findById as jest.Mock).mockResolvedValue(news);
      (publisher.publish as jest.Mock).mockRejectedValue(new Error('Network Error'));
      (newsService.revertPublishingClaim as jest.Mock).mockResolvedValue(true);

      const result = await service.publishOne('uuid-1');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(newsService.revertPublishingClaim).toHaveBeenCalledWith('uuid-1');
      expect(newsService.markPublished).not.toHaveBeenCalled();
    });

    it('should not send duplicate to Telegram when DB update fails after Telegram success', async () => {
      const news = mockNews({ status: NewsStatus.APPROVED });
      // Первая попытка: claim успешен, Telegram успешно отправил, но markPublished вернул false (DB failure).
      (newsService.claimForPublishing as jest.Mock).mockResolvedValueOnce(true);
      (newsService.findById as jest.Mock).mockResolvedValueOnce(news);
      (publisher.publish as jest.Mock).mockResolvedValueOnce('123456');
      (newsService.markPublished as jest.Mock).mockResolvedValueOnce(false);

      const firstResult = await service.publishOne('uuid-1');
      expect(firstResult).toEqual({ processed: 0, skipped: 0, errors: 1 });

      // Повторная попытка: новость уже PUBLISHED (claim не удался), Telegram НЕ вызывается.
      const publishedNews = mockNews({ status: NewsStatus.PUBLISHED, telegramMessageId: null });
      (newsService.claimForPublishing as jest.Mock).mockResolvedValueOnce(false);
      (newsService.findById as jest.Mock).mockResolvedValueOnce(publishedNews);

      const secondResult = await service.publishOne('uuid-1');
      expect(secondResult).toEqual({ processed: 0, skipped: 1, errors: 0 });
      expect(publisher.publish).toHaveBeenCalledTimes(1); // только один раз
    });

    it('should not send duplicate when concurrent publish attempts race (only one wins claim)', async () => {
      const news = mockNews({ status: NewsStatus.APPROVED });
      // Первый запрос выигрывает claim.
      (newsService.claimForPublishing as jest.Mock).mockResolvedValueOnce(true);
      (newsService.findById as jest.Mock).mockResolvedValueOnce(news);
      (publisher.publish as jest.Mock).mockResolvedValueOnce('11111');
      (newsService.markPublished as jest.Mock).mockResolvedValueOnce(true);

      // Второй запрос проигрывает claim (новость уже PUBLISHED).
      const publishedNews = mockNews({ status: NewsStatus.PUBLISHED, telegramMessageId: '11111' });
      (newsService.claimForPublishing as jest.Mock).mockResolvedValueOnce(false);
      (newsService.findById as jest.Mock).mockResolvedValueOnce(publishedNews);

      const [result1, result2] = await Promise.all([
        service.publishOne('uuid-1'),
        service.publishOne('uuid-1'),
      ]);

      expect(result1).toEqual({ processed: 1, skipped: 0, errors: 0 });
      expect(result2).toEqual({ processed: 0, skipped: 1, errors: 0 });
      expect(publisher.publish).toHaveBeenCalledTimes(1); // только один раз
    });

    it('should revert claim if news disappears after claim', async () => {
      (newsService.claimForPublishing as jest.Mock).mockResolvedValue(true);
      (newsService.findById as jest.Mock).mockResolvedValue(null);
      (newsService.revertPublishingClaim as jest.Mock).mockResolvedValue(true);

      const result = await service.publishOne('uuid-1');

      expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
      expect(newsService.revertPublishingClaim).toHaveBeenCalledWith('uuid-1');
      expect(publisher.publish).not.toHaveBeenCalled();
    });
  });

  describe('publishPending', () => {
    it('should publish all approved news in batch', async () => {
      const news1 = mockNews({ id: 'uuid-1', status: NewsStatus.APPROVED });
      const news2 = mockNews({ id: 'uuid-2', status: NewsStatus.APPROVED });
      (newsService.findByStatus as jest.Mock).mockResolvedValue([news1, news2]);
      (newsService.claimForPublishing as jest.Mock).mockResolvedValue(true);
      (newsService.findById as jest.Mock)
        .mockResolvedValueOnce(news1)
        .mockResolvedValueOnce(news2);
      (publisher.publish as jest.Mock).mockResolvedValue('11111');
      (newsService.markPublished as jest.Mock).mockResolvedValue(true);

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
      (newsService.claimForPublishing as jest.Mock).mockResolvedValue(true);
      (newsService.findById as jest.Mock)
        .mockResolvedValueOnce(news1)
        .mockResolvedValueOnce(news2)
        .mockResolvedValueOnce(news3);

      (publisher.publish as jest.Mock)
        .mockResolvedValueOnce('11111')
        .mockRejectedValueOnce(new Error('Telegram error'))
        .mockResolvedValueOnce('33333');
      (newsService.markPublished as jest.Mock).mockResolvedValue(true);
      (newsService.revertPublishingClaim as jest.Mock).mockResolvedValue(true);

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