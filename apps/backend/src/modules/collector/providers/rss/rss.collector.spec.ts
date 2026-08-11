import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RssCollector } from './rss.collector';
import { LoggerService } from '../../../../common/logger/logger.service';
import { NewsSource } from '../../../news/entities/news.entity';
import * as Parser from 'rss-parser';

// Мокаем rss-parser через фабрику
const mockParseURL = jest.fn();
jest.mock('rss-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: mockParseURL,
  }));
});

describe('RssCollector', () => {
  let collector: RssCollector;
  let configService: ConfigService;
  let loggerService: LoggerService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RssCollector,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: string) => {
              if (key === 'RSS_FEEDS') {
                return 'https://test.com/feed.xml, https://error.com/feed.xml';
              }
              return defaultValue;
            }),
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

    collector = module.get<RssCollector>(RssCollector);
    configService = module.get<ConfigService>(ConfigService);
    loggerService = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(collector).toBeDefined();
  });

  it('should successfully collect news from multiple feeds', async () => {
    const mockFeed = {
      title: 'Test Feed',
      items: [
        {
          title: 'News 1',
          link: 'https://test.com/1',
          guid: 'guid-1',
          isoDate: '2026-08-11T10:00:00Z',
          content: 'Content 1',
          creator: 'Author 1',
          categories: ['Business'],
        },
        {
          title: 'News 2',
          link: 'https://test.com/2',
          isoDate: '2026-08-11T11:00:00Z',
          summary: 'Summary 2',
        },
      ],
    };

    mockParseURL.mockImplementation((url: string) => {
      if (url === 'https://test.com/feed.xml') {
        return Promise.resolve(mockFeed);
      }
      return Promise.reject(new Error('Network error'));
    });

    const result = await collector.collect();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      sourceId: 'guid-1',
      source: NewsSource.RSS,
      sourceName: 'Test Feed',
      rawText: 'Content 1',
      author: 'Author 1',
    });
    expect(result[1]).toMatchObject({
      sourceId: 'https://test.com/2', // uses link as guid is missing
      rawText: 'Summary 2',
    });
    
    // Проверка, что ошибка в одном фиде не сломала сбор другого
    expect(loggerService.error).toHaveBeenCalled();
  });

  it('should filter news by since date', async () => {
    const mockFeed = {
      title: 'Test Feed',
      items: [
        {
          title: 'Old News',
          link: 'https://test.com/old',
          isoDate: '2026-08-10T10:00:00Z',
        },
        {
          title: 'New News',
          link: 'https://test.com/new',
          isoDate: '2026-08-11T10:00:00Z',
        },
      ],
    };

    mockParseURL.mockResolvedValue(mockFeed);
    
    // Переопределяем конфиг только для одного фида для простоты
    jest.spyOn(configService, 'get').mockReturnValue('https://test.com/feed.xml');

    const since = new Date('2026-08-11T00:00:00Z');
    const result = await collector.collect(since);

    expect(result).toHaveLength(1);
    expect(result[0].sourceUrl).toBe('https://test.com/new');
  });

  it('should handle empty config gracefully', async () => {
    jest.spyOn(configService, 'get').mockReturnValue('');
    
    const result = await collector.collect();
    
    expect(result).toEqual([]);
    expect(loggerService.warn).toHaveBeenCalledWith(expect.stringContaining('No RSS feeds configured'), expect.any(String));
  });

  it('should perform defensive mapping of rawText', async () => {
    const mockFeed = {
      title: 'Defensive Feed',
      items: [
        {
          title: 'Only Description',
          link: 'https://test.com/desc',
          description: 'Desc text',
        },
        {
          title: 'Only snippet',
          link: 'https://test.com/snippet',
          contentSnippet: 'Snippet text',
        },
      ],
    };

    mockParseURL.mockResolvedValue(mockFeed);
    jest.spyOn(configService, 'get').mockReturnValue('https://test.com/feed.xml');

    const result = await collector.collect();

    expect(result[0].rawText).toBe('Desc text');
    expect(result[1].rawText).toBe('Snippet text');
  });
});
