import { Injectable } from '@nestjs/common';
import { CollectorService } from '../collector/collector.service';
import { NewsService } from '../news/news.service';
import { NewsSource } from '../news/constants/news-source.enum';
import { NewsLanguage } from '../news/constants/news-language.enum';
import { NewsStatus } from '../news/entities/news.entity';
import { CollectedNews } from '../collector/interfaces/collected-news.interface';
import { LoggerService } from '../../common/logger/logger.service';
import { SourceTiersService } from './source-tiers.service';
import { computeNewsHash } from './news-hash.util';

export interface IngestionResult {
  collected: number;
  saved: number;
  skipped: number;
  errors: number;
}

@Injectable()
export class IngestionService {
  private readonly context = 'IngestionService';

  constructor(
    private readonly collectorService: CollectorService,
    private readonly newsService: NewsService,
    private readonly logger: LoggerService,
    private readonly sourceTiers: SourceTiersService,
  ) {}

  /**
   * Запуск процесса сбора и сохранения новостей из RSS.
   * @param since Опциональная дата для фильтрации новостей
   */
  async ingestFromRss(since?: Date): Promise<IngestionResult> {
    this.logger.log(`Starting RSS ingestion flow...`, this.context);

    let collectedNews: CollectedNews[] = [];
    try {
      collectedNews = await this.collectorService.collectFrom(NewsSource.RSS, since);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Collector failed during RSS ingestion: ${msg}`, error instanceof Error ? error.stack : undefined, this.context);
      return { collected: 0, saved: 0, skipped: 0, errors: 1 };
    }

    const result: IngestionResult = {
      collected: collectedNews.length,
      saved: 0,
      skipped: 0,
      errors: 0,
    };

    if (collectedNews.length === 0) {
      this.logger.log(`Ingestion finished. No news collected.`, this.context);
      return result;
    }

    this.logger.log(`Collected ${collectedNews.length} news items. Processing persistence...`, this.context);

    for (const collected of collectedNews) {
      try {
        // Стабильный хэш от нормализованного текста
        const hash = computeNewsHash(collected.rawText);

        // Dual-check дедупликации: сначала по hash, затем по source + sourceId
        if (await this.isDuplicate(collected, hash)) {
          result.skipped++;
          continue;
        }

        // Создаем и сохраняем новость
        await this.newsService.create({
          sourceId: collected.sourceId || '',
          sourceUrl: collected.sourceUrl,
          source: collected.source,
          sourceName: collected.sourceName,
          author: collected.author,
          rawText: collected.rawText,
          sourceLanguage: collected.sourceLanguage || NewsLanguage.EN,
          status: NewsStatus.RAW,
          category: collected.category,
          hash: hash,
          publishedAt: collected.publishedAt,
          // Sprint 22b: tier из конфига source.tiers.json (единая точка для всех коллекторов).
          sourceTier: this.sourceTiers.resolve(collected.sourceName),
        });

        result.saved++;
      } catch (error) {
        result.errors++;
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to save news item ${collected.sourceId}: ${msg}`, error instanceof Error ? error.stack : undefined, this.context);
      }
    }

    this.logger.log(
      `Ingestion complete. Collected: ${result.collected}, Saved: ${result.saved}, Skipped: ${result.skipped}, Errors: ${result.errors}`,
      this.context,
    );

    return result;
  }

  /**
   * Проверка дубликата: по hash (нормализованный текст) и по source + sourceId.
   * Возвращает true, если новость уже существует.
   */
  private async isDuplicate(collected: CollectedNews, hash: string): Promise<boolean> {
    // Проверка по хэшу нормализованного текста
    const existingByHash = await this.newsService.findByHash(hash);
    if (existingByHash) {
      this.logger.debug(`Skipping news (hash duplicate): ${collected.sourceId}`, this.context);
      return true;
    }

    // Проверка по источнику и ID события в источнике
    if (collected.sourceId) {
      const existingBySourceId = await this.newsService.findBySource(collected.source, collected.sourceId);
      if (existingBySourceId) {
        this.logger.debug(`Skipping news (sourceId duplicate): ${collected.sourceId}`, this.context);
        return true;
      }
    }

    return false;
  }
}
