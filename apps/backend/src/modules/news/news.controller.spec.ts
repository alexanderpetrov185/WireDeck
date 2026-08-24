import { Test, TestingModule } from '@nestjs/testing';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { NewsStatus } from './entities/news.entity';
import { TokenGuard } from '../../common/guards/token.guard';
import { ConfigService } from '@nestjs/config';

describe('NewsController', () => {
  let controller: NewsController;
  let newsService: NewsService;

  const mockNews = (overrides: Partial<any> = {}) => ({
    id: 'uuid-1',
    sourceId: 'rss-1',
    source: 'rss',
    sourceUrl: 'https://test.com/1',
    sourceName: 'Test Feed',
    author: 'Author 1',
    rawText: 'Original text content',
    sourceLanguage: 'en',
    status: NewsStatus.RAW,
    title: 'Test Title',
    summary: null,
    translatedText: null,
    importance: null,
    category: null,
    hash: 'abc123',
    duplicateOf: null,
    telegramMessageId: null,
    moderatedBy: null,
    moderatedAt: null,
    rejectionReason: null,
    publishedAt: null,
    createdAt: new Date('2026-08-11T10:00:00Z'),
    updatedAt: new Date('2026-08-11T10:00:00Z'),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NewsController],
      providers: [
        {
          provide: NewsService,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            countByStatus: jest.fn(),
          },
        },
        {
          provide: TokenGuard,
          useValue: { canActivate: jest.fn(() => true) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'test-token') },
        },
      ],
    }).compile();

    controller = module.get<NewsController>(NewsController);
    newsService = module.get<NewsService>(NewsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /news', () => {
    it('should return list with default pagination', async () => {
      const news = [mockNews()];
      (newsService.findAll as jest.Mock).mockResolvedValue(news);

      const result = await controller.list(undefined, undefined, undefined);

      expect(result).toEqual(news);
      expect(newsService.findAll).toHaveBeenCalledWith(50, 0, undefined);
    });

    it('should pass limit/skip/status to service', async () => {
      (newsService.findAll as jest.Mock).mockResolvedValue([]);

      await controller.list(25, 10, NewsStatus.QUEUED);

      expect(newsService.findAll).toHaveBeenCalledWith(25, 10, NewsStatus.QUEUED);
    });

    it('should reject invalid limit (0)', async () => {
      await expect(controller.list(0, 0, undefined)).rejects.toThrow('limit must be an integer between 1 and 100');
    });

    it('should reject limit > 100', async () => {
      await expect(controller.list(101, 0, undefined)).rejects.toThrow('limit must be an integer between 1 and 100');
    });

    it('should reject negative skip', async () => {
      await expect(controller.list(50, -1, undefined)).rejects.toThrow('skip must be a non-negative integer');
    });

    it('should reject unknown status', async () => {
      await expect(controller.list(50, 0, 'nonexistent')).rejects.toThrow('Invalid status');
    });
  });

  describe('GET /news/stats', () => {
    it('should return real counts for all statuses + total', async () => {
      (newsService.countByStatus as jest.Mock).mockImplementation(async (status: NewsStatus) => {
        const map: Record<string, number> = {
          raw: 10,
          processed: 5,
          translated: 3,
          queued: 2,
          approved: 1,
          published: 4,
          rejected: 0,
        };
        return map[status] ?? 0;
      });

      const result = await controller.stats();

      expect(result).toEqual({
        raw: 10,
        processed: 5,
        translated: 3,
        queued: 2,
        approved: 1,
        published: 4,
        rejected: 0,
        total: 25,
      });
      // stats не должен вызывать findById (не попадает в /:id)
      expect(newsService.findById).not.toHaveBeenCalled();
    });
  });

  describe('GET /news/:id', () => {
    it('should return news by id', async () => {
      const news = mockNews({ id: 'uuid-1' });
      (newsService.findById as jest.Mock).mockResolvedValue(news);

      const result = await controller.getOne('uuid-1');

      expect(result).toEqual(news);
      expect(newsService.findById).toHaveBeenCalledWith('uuid-1');
    });

    it('should throw 404 when news not found', async () => {
      (newsService.findById as jest.Mock).mockResolvedValue(null);

      await expect(controller.getOne('missing')).rejects.toThrow('News missing not found');
    });
  });
});