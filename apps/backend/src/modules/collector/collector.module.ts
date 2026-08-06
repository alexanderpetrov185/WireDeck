// Модуль сбора новостей (Sprint 2)
// НЕ зависит от NewsModule и от базы данных.
// Работает только с интерфейсом CollectedNews.

import { Module } from '@nestjs/common';
import { CollectorService } from './collector.service';
import { NewsCollector } from './interfaces/news-collector.interface';
import { NEWS_COLLECTORS } from './constants/collector.tokens';
import { RssCollector } from './providers/rss/rss.collector';
import { TwitterCollector } from './providers/twitter/twitter.collector';
import { NewsApiCollector } from './providers/newsapi/newsapi.collector';
import { GoogleNewsCollector } from './providers/google-news/google-news.collector';
import { BinanceCollector } from './providers/binance/binance.collector';
import { CoinGeckoCollector } from './providers/coingecko/coingecko.collector';

@Module({
  providers: [
    CollectorService,
    RssCollector,
    TwitterCollector,
    NewsApiCollector,
    GoogleNewsCollector,
    BinanceCollector,
    CoinGeckoCollector,
    // Собираем все коллекторы в один массив через DI-фабрику.
    // DI подхватывает инстансы классов, зарегистрированных выше.
    {
      provide: NEWS_COLLECTORS,
      useFactory: (
        rss: RssCollector,
        twitter: TwitterCollector,
        newsapi: NewsApiCollector,
        googleNews: GoogleNewsCollector,
        binance: BinanceCollector,
        coingecko: CoinGeckoCollector,
      ): NewsCollector[] => [rss, twitter, newsapi, googleNews, binance, coingecko],
      inject: [
        RssCollector,
        TwitterCollector,
        NewsApiCollector,
        GoogleNewsCollector,
        BinanceCollector,
        CoinGeckoCollector,
      ],
    },
  ],
  exports: [CollectorService],
})
export class CollectorModule {}