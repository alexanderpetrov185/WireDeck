import { Test, TestingModule } from '@nestjs/testing';
import { TranslationService } from './translation.service';
import { NewsService } from '../news/news.service';
import { TranslationProvider } from './translation-provider.interface';
import { LoggerService } from '../../common/logger/logger.service';
import { TRANSLATION_PROVIDER } from './translation-provider.token';
import { NewsStatus, NewsLanguage } from '../news/entities/news.entity';

describe('TranslationService', () => {
  let service: TranslationService;
  let newsService: NewsService;
  let translationProvider: TranslationProvider;
  let loggerService: LoggerService;

  const mockNews = (overrides: Partial<any> = {}) => ({
    id: 'uuid-1',
    sourceId: 'rss-1',
    source: 'rss',
    sourceUrl: 'https://test.com/1',
    sourceName: 'Test Feed',
    author: 'Author 1',
    rawText: 'Original text content',
    sourceLanguage: NewsLanguage.EN,
    status: NewsStatus.PROCESSED,
    title: 'Test Title',
    summary: 'This is a summary of the news article.',
    translatedText: null,
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
        TranslationService,
        {
          provide: NewsService,
          useValue: {
            findById: jest.fn(),
            findByStatus: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: TRANSLATION_PROVIDER,
          useValue: {
            translate: jest.fn(),
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

    service = module.get<TranslationService>(TranslationService);
    newsService = module.get<NewsService>(NewsService);
    translationProvider = module.get(TRANSLATION_PROVIDER);
    loggerService = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should successfully translate one news', async () => {
    const news = mockNews({ status: NewsStatus.PROCESSED, summary: 'Original summary' });
    (newsService.findById as jest.Mock).mockResolvedValue(news);
    (translationProvider.translate as jest.Mock).mockResolvedValue('Переведённая выжимка');
    (newsService.update as jest.Mock).mockResolvedValue({ ...news, translatedText: 'Переведённая выжимка', status: NewsStatus.TRANSLATED });

    const result = await service.translateOne('uuid-1', 'en');

    expect(result).toEqual({ processed: 1, skipped: 0, errors: 0 });
    expect(translationProvider.translate).toHaveBeenCalledWith('Original summary', 'en');
    expect(newsService.update).toHaveBeenCalledWith('uuid-1', {
      translatedText: 'Переведённая выжимка',
      status: NewsStatus.TRANSLATED,
    });
  });

  it('should skip RAW news (translation requires PROCESSED first)', async () => {
    const news = mockNews({ status: NewsStatus.RAW, summary: 'Original summary' });
    (newsService.findById as jest.Mock).mockResolvedValue(news);

    const result = await service.translateOne('uuid-1', 'en');

    expect(result).toEqual({ processed: 0, skipped: 1, errors: 0 });
    expect(translationProvider.translate).not.toHaveBeenCalled();
  });

  it('should skip already translated news without force', async () => {
    const news = mockNews({ status: NewsStatus.TRANSLATED, summary: 'Original summary', translatedText: 'Already translated' });
    (newsService.findById as jest.Mock).mockResolvedValue(news);

    const result = await service.translateOne('uuid-1', 'en');

    expect(result).toEqual({ processed: 0, skipped: 1, errors: 0 });
    expect(translationProvider.translate).not.toHaveBeenCalled();
  });

  it('should re-translate TRANSLATED news with force', async () => {
    const news = mockNews({ status: NewsStatus.TRANSLATED, summary: 'Original summary', translatedText: 'Old translation' });
    (newsService.findById as jest.Mock).mockResolvedValue(news);
    (translationProvider.translate as jest.Mock).mockResolvedValue('New translation');
    (newsService.update as jest.Mock).mockResolvedValue({ ...news, translatedText: 'New translation', status: NewsStatus.TRANSLATED });

    const result = await service.translateOne('uuid-1', 'en', true);

    expect(result).toEqual({ processed: 1, skipped: 0, errors: 0 });
    expect(translationProvider.translate).toHaveBeenCalledWith('Original summary', 'en');
  });

  it('should skip news with empty summary', async () => {
    const news = mockNews({ status: NewsStatus.PROCESSED, summary: null });
    (newsService.findById as jest.Mock).mockResolvedValue(news);

    const result = await service.translateOne('uuid-1', 'en');

    expect(result).toEqual({ processed: 0, skipped: 1, errors: 0 });
    expect(translationProvider.translate).not.toHaveBeenCalled();
  });

  it('should skip news with empty string summary', async () => {
    const news = mockNews({ status: NewsStatus.PROCESSED, summary: '   ' });
    (newsService.findById as jest.Mock).mockResolvedValue(news);

    const result = await service.translateOne('uuid-1', 'en');

    expect(result).toEqual({ processed: 0, skipped: 1, errors: 0 });
    expect(translationProvider.translate).not.toHaveBeenCalled();
  });

  it('should handle news not found', async () => {
    (newsService.findById as jest.Mock).mockResolvedValue(null);

    const result = await service.translateOne('nonexistent', 'en');

    expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
    expect(translationProvider.translate).not.toHaveBeenCalled();
  });

  it('should handle provider error for one news', async () => {
    const news = mockNews({ status: NewsStatus.PROCESSED, summary: 'Original summary' });
    (newsService.findById as jest.Mock).mockResolvedValue(news);
    (translationProvider.translate as jest.Mock).mockRejectedValue(new Error('Provider unavailable'));

    const result = await service.translateOne('uuid-1', 'en');

    expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
    expect(loggerService.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to translate news uuid-1'),
      expect.any(String),
      expect.any(String),
    );
  });

  it('should handle DB write error as error for that news', async () => {
    const news = mockNews({ status: NewsStatus.PROCESSED, summary: 'Original summary' });
    (newsService.findById as jest.Mock).mockResolvedValue(news);
    (translationProvider.translate as jest.Mock).mockResolvedValue('Переведённая выжимка');
    (newsService.update as jest.Mock).mockRejectedValue(new Error('DB write failed'));

    const result = await service.translateOne('uuid-1', 'en');

    expect(result).toEqual({ processed: 0, skipped: 0, errors: 1 });
    expect(loggerService.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to translate news uuid-1'),
      expect.any(String),
      expect.any(String),
    );
  });

  it('should process batch of PROCESSED news', async () => {
    const news1 = mockNews({ id: 'uuid-1', status: NewsStatus.PROCESSED, summary: 'Summary 1' });
    const news2 = mockNews({ id: 'uuid-2', status: NewsStatus.PROCESSED, summary: 'Summary 2' });
    (newsService.findByStatus as jest.Mock).mockResolvedValue([news1, news2]);
    (newsService.findById as jest.Mock)
      .mockResolvedValueOnce(news1)
      .mockResolvedValueOnce(news2);
    (translationProvider.translate as jest.Mock).mockResolvedValue('Перевод');
    (newsService.update as jest.Mock).mockResolvedValue({});

    const result = await service.translatePending(50, 'en');

    expect(result).toEqual({ processed: 2, skipped: 0, errors: 0 });
    expect(translationProvider.translate).toHaveBeenCalledTimes(2);
  });

  it('should skip already translated in batch without force', async () => {
    const news1 = mockNews({ id: 'uuid-1', status: NewsStatus.PROCESSED, summary: 'Summary 1' });
    const news2 = mockNews({ id: 'uuid-2', status: NewsStatus.TRANSLATED, summary: 'Summary 2', translatedText: 'Already translated' });
    (newsService.findByStatus as jest.Mock).mockResolvedValue([news1, news2]);
    (newsService.findById as jest.Mock)
      .mockResolvedValueOnce(news1)
      .mockResolvedValueOnce(news2);
    (translationProvider.translate as jest.Mock).mockResolvedValue('Перевод');
    (newsService.update as jest.Mock).mockResolvedValue({});

    const result = await service.translatePending(50, 'en');

    expect(result).toEqual({ processed: 1, skipped: 1, errors: 0 });
    expect(translationProvider.translate).toHaveBeenCalledTimes(1);
  });

  it('should not break batch when one news fails', async () => {
    const news1 = mockNews({ id: 'uuid-1', status: NewsStatus.PROCESSED, summary: 'Summary 1' });
    const news2 = mockNews({ id: 'uuid-2', status: NewsStatus.PROCESSED, summary: 'Summary 2' });
    const news3 = mockNews({ id: 'uuid-3', status: NewsStatus.PROCESSED, summary: 'Summary 3' });
    (newsService.findByStatus as jest.Mock).mockResolvedValue([news1, news2, news3]);
    (newsService.findById as jest.Mock)
      .mockResolvedValueOnce(news1)
      .mockResolvedValueOnce(news2)
      .mockResolvedValueOnce(news3);
    (translationProvider.translate as jest.Mock)
      .mockResolvedValueOnce('Перевод 1')
      .mockRejectedValueOnce(new Error('Provider error'))
      .mockResolvedValueOnce('Перевод 3');
    (newsService.update as jest.Mock).mockResolvedValue({});

    const result = await service.translatePending(50, 'en');

    expect(result).toEqual({ processed: 2, skipped: 0, errors: 1 });
    expect(translationProvider.translate).toHaveBeenCalledTimes(3);
  });

  it('should include TRANSLATED news in batch with force', async () => {
    const processedNews = mockNews({ id: 'uuid-1', status: NewsStatus.PROCESSED, summary: 'Summary 1' });
    const translatedNews = mockNews({ id: 'uuid-2', status: NewsStatus.TRANSLATED, summary: 'Summary 2', translatedText: 'Old' });
    (newsService.findByStatus as jest.Mock)
      .mockResolvedValueOnce([processedNews])
      .mockResolvedValueOnce([translatedNews]);
    (newsService.findById as jest.Mock)
      .mockResolvedValueOnce(processedNews)
      .mockResolvedValueOnce(translatedNews);
    (translationProvider.translate as jest.Mock).mockResolvedValue('Перевод');
    (newsService.update as jest.Mock).mockResolvedValue({});

    const result = await service.translatePending(50, 'en', true);

    expect(result).toEqual({ processed: 2, skipped: 0, errors: 0 });
    expect(newsService.findByStatus).toHaveBeenCalledWith(NewsStatus.PROCESSED, 50);
    expect(newsService.findByStatus).toHaveBeenCalledWith(NewsStatus.TRANSLATED, 50);
  });

  it('should handle empty batch', async () => {
    (newsService.findByStatus as jest.Mock).mockResolvedValue([]);

    const result = await service.translatePending(50, 'en');

    expect(result).toEqual({ processed: 0, skipped: 0, errors: 0 });
    expect(translationProvider.translate).not.toHaveBeenCalled();
  });
});
