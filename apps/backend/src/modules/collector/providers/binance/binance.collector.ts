// Binance-коллектор
// Заглушка: возвращает пустой массив. Реальная логика сбора будет добавлена позже.

import { Injectable } from '@nestjs/common';
import { NewsSource } from '../../../news/constants/news-source.enum';
import { NewsCollector } from '../../interfaces/news-collector.interface';
import { CollectedNews } from '../../interfaces/collected-news.interface';

@Injectable()
export class BinanceCollector implements NewsCollector {
  readonly source = NewsSource.BINANCE;

  async collect(_since?: Date): Promise<CollectedNews[]> {
    // TODO: реализовать сбор из Binance
    return [];
  }
}