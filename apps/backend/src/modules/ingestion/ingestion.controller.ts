import { Controller, Post, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { IngestionService, IngestionResult } from './ingestion.service';
// Sprint cleanup: duplicate ingestion.guard removed; common TokenGuard is used.
import { TokenGuard } from '../../common/guards/token.guard';

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  /**
   * Ручной запуск сбора новостей из RSS-лент и сохранения в базу данных.
   * Роут: POST /ingestion/rss
   * Требует заголовок x-ingestion-token (см. INGESTION_TOKEN в env).
   * @param since РћРїС†РёРѕРЅР°Р»СЊРЅР°СЏ РґР°С‚Р° С„РёР»СЊС‚СЂР°С†РёРё (РЅР°РїСЂРёРјРµСЂ: 2026-08-11T00:00:00Z)
   */
  @Post('rss')
  @UseGuards(TokenGuard)
  @HttpCode(HttpStatus.OK)
  async runRssIngestion(@Query('since') since?: string): Promise<IngestionResult> {
    const sinceDate = since ? new Date(since) : undefined;
    // Р•СЃР»Рё РґР°С‚Р° РЅРµРєРѕСЂСЂРµРєС‚РЅР°СЏ, РёРіРЅРѕСЂРёСЂСѓРµРј РµРµ
    const validSinceDate = sinceDate && !isNaN(sinceDate.getTime()) ? sinceDate : undefined;

    return this.ingestionService.ingestFromRss(validSinceDate);
  }
}
