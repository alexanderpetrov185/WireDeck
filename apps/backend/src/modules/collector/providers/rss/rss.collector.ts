// RSS-коллектор (Sprint 3)
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Parser from 'rss-parser';
import { NewsSource, NewsLanguage } from '../../../news/entities/news.entity';
import { NewsCollector } from '../../interfaces/news-collector.interface';
import { CollectedNews } from '../../interfaces/collected-news.interface';
import { LoggerService } from '../../../../common/logger/logger.service';

@Injectable()
export class RssCollector implements NewsCollector {
  readonly source = NewsSource.RSS;
  private readonly parser: Parser;
  private readonly context = 'RssCollector';

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.parser = new Parser({
      timeout: 10000, // 10 секунд таймаут для парсера
    });
  }

  /**
   * Сбор новостей из RSS-фидов, указанных в конфигурации.
   * @param since Опциональная дата, после которой новости считаются новыми.
   */
  async collect(since?: Date): Promise<CollectedNews[]> {
    const feedsConfig = this.configService.get<string>('RSS_FEEDS', '');
    const feedUrls = feedsConfig
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (feedUrls.length === 0) {
      this.logger.warn('No RSS feeds configured. Check RSS_FEEDS environment variable.', this.context);
      return [];
    }

    this.logger.log(`Starting collection from ${feedUrls.length} RSS feeds`, this.context);

    // Используем Promise.allSettled, чтобы ошибка в одном фиде не прерывала сбор других.
    const results = await Promise.allSettled(
      feedUrls.map((url) => this.fetchAndParseFeed(url, since)),
    );

    const allNews: CollectedNews[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allNews.push(...result.value);
      } else {
        this.logger.error(`Failed to collect from feed ${feedUrls[index]}: ${result.reason}`, undefined, this.context);
      }
    });

    this.logger.log(`Total collected and filtered RSS news: ${allNews.length}`, this.context);
    return allNews;
  }

  /**
   * Загрузка и парсинг отдельного фида.
   */
  private async fetchAndParseFeed(url: string, since?: Date): Promise<CollectedNews[]> {
    try {
      const feed = await this.parser.parseURL(url);
      const sourceName = feed.title || url;

      const items = feed.items || [];
      const collected: CollectedNews[] = items
        .map((item) => this.mapToCollectedNews(item, sourceName))
        .filter((news) => {
          // Фильтрация по дате
          if (since && news.publishedAt) {
            return news.publishedAt > since;
          }
          return true;
        });

      this.logger.debug(`Collected ${collected.length} news from ${url}`, this.context);
      return collected;
    } catch (error) {
      // Пробрасываем ошибку дальше для обработки в collect() через Promise.allSettled
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message);
    }
  }

  /**
   * Маппинг элемента фида в нормализованный формат CollectedNews.
   * Реализован defensive mapping согласно требованиям.
   */
  private mapToCollectedNews(item: any, sourceName: string): CollectedNews {
    const publishedAt = item.isoDate ? new Date(item.isoDate) : (item.pubDate ? new Date(item.pubDate) : null);
    
    // Defensive mapping: ищем контент в разных возможных полях
    const rawText = item['content:encoded'] || item.content || item.summary || item.contentSnippet || item.description || '';

    return {
      // sourceId: guid приоритетнее, если нет - используем link
      sourceId: item.guid || item.link || `${sourceName}-${item.title}-${publishedAt?.getTime()}`,
      source: NewsSource.RSS,
      sourceName: sourceName,
      author: item.creator || item.author || null,
      sourceUrl: item.link || null,
      rawText: rawText,
      sourceLanguage: NewsLanguage.EN, // По умолчанию EN, т.к. RSS-парсер редко надежно отдает lang
      category: (Array.isArray(item.categories) && item.categories.length > 0) ? item.categories[0] : null,
      publishedAt: publishedAt,
    };
  }
}
