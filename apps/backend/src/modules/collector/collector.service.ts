// Диспетчер коллекторов новостей
// Инжектит ВСЕ зарегистрированные коллекторы через DI (NEWS_COLLECTORS)
// и предоставляет единый интерфейс для сбора новостей.
// Коллектор не знает о базе данных — только интерфейс CollectedNews.

import { Injectable, Inject } from '@nestjs/common';
import { NewsSource } from '../news/constants/news-source.enum';
import { NEWS_COLLECTORS } from './constants/collector.tokens';
import { NewsCollector } from './interfaces/news-collector.interface';
import { CollectedNews } from './interfaces/collected-news.interface';
import { LoggerService } from '../../common/logger/logger.service';

@Injectable()
export class CollectorService {
  private readonly context = 'CollectorService';

  constructor(
    // Массив всех зарегистрированных коллекторов (multi-provider)
    @Inject(NEWS_COLLECTORS)
    private readonly collectors: NewsCollector[],
    private readonly logger: LoggerService,
  ) {}

  // Сбор новостей со всех источников
  async collectAll(since?: Date): Promise<CollectedNews[]> {
    const results = await Promise.all(
      this.collectors.map((collector) => collector.collect(since)),
    );
    const all = results.flat();
    this.logger.log(`Collected ${all.length} news from ${this.collectors.length} sources`, this.context);
    return all;
  }

  // Сбор новостей с конкретного источника
  async collectFrom(source: NewsSource, since?: Date): Promise<CollectedNews[]> {
    const collector = this.collectors.find((c) => c.source === source);
    if (!collector) {
      this.logger.warn(`No collector registered for source: ${source}`, this.context);
      return [];
    }
    const news = await collector.collect(since);
    this.logger.log(`Collected ${news.length} news from ${source}`, this.context);
    return news;
  }
}