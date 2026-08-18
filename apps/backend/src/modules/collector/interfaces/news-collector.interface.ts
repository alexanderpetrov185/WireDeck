// Контракт коллектора новостей.
// Каждый источник (RSS, Twitter, NewsAPI и т.д.) реализует этот интерфейс.
// Коллектор НЕ знает о базе данных — он только собирает и нормализует данные.

import { NewsSource } from '../../news/constants/news-source.enum';
import { CollectedNews } from './collected-news.interface';

export interface NewsCollector {
  // Какой источник обслуживает данный коллектор
  readonly source: NewsSource;

  // Сбор и нормализация новостей из источника.
  // since — опционально: собрать только новости, опубликованные после указанной даты.
  collect(since?: Date): Promise<CollectedNews[]>;
}