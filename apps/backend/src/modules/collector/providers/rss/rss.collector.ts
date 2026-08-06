// RSS-коллектор
// Заглушка: возвращает пустой массив. Реальная логика сбора будет добавлена позже.

import { Injectable } from '@nestjs/common';
import { NewsSource } from '../../../news/entities/news.entity';
import { NewsCollector } from '../../interfaces/news-collector.interface';
import { CollectedNews } from '../../interfaces/collected-news.interface';

@Injectable()
export class RssCollector implements NewsCollector {
  readonly source = NewsSource.RSS;

  async collect(_since?: Date): Promise<CollectedNews[]> {
    // TODO: реализовать сбор из RSS-фидов
    return [];
  }
}