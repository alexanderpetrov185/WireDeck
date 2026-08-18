// Тип источника данных
// Вынесен из news.entity.ts, чтобы Collector и другие модули
// не импортировали TypeORM-сущности (архитектурная граница).
export enum NewsSource {
  TWITTER = 'twitter',
  NEWSAPI = 'newsapi',
  GOOGLE_NEWS = 'google_news',
  BINANCE = 'binance',
  COINGECKO = 'coingecko',
  RSS = 'rss',
  MANUAL = 'manual',
}