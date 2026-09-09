// Нормализованный объект новости, полученной из внешнего источника
// НЕ зависит от TypeORM. НЕ является Entity.
// Содержит только данные, полученные от коллектора.

import { NewsSource } from '../../news/constants/news-source.enum';
import { NewsLanguage } from '../../news/constants/news-language.enum';

export interface CollectedNews {
  // ID события в источнике (tweet id / article id / symbol+timestamp)
  sourceId: string;

  // Тип источника (переиспользуем enum из News entity)
  source: NewsSource;

  // Имя источника
  sourceName: string;

  // Автор/аккаунт (для Twitter/X и RSS)
  author: string | null;

  // Ссылка на оригинал
  sourceUrl: string | null;

  // Сырой текст с источника
  rawText: string;

  // Язык оригинала
  sourceLanguage: NewsLanguage;

  // Категория: news / tweet / price-alert / analytics
  category: string | null;

  // Время публикации в источнике
  publishedAt: Date | null;

  // ── Sprint 22c: overrides от источников со своим tier-конфигом ──
  // (Twitter watchlist). Если заданы — приоритетнее source.tiers.json.
  tierOverride?: number | null;
  unconfirmedOverride?: boolean | null;
}