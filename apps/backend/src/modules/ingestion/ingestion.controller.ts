import { Controller, Post, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { IngestionService, IngestionResult } from './ingestion.service';
// Sprint cleanup: duplicate ingestion.guard removed; common TokenGuard is used.
import { TokenGuard } from '../../common/guards/token.guard';

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  /**
   * Р СѓС‡РЅРѕР№ Р·Р°РїСѓСЃРє СЃР±РѕСЂР° РЅРѕРІРѕСЃС‚РµР№ РёР· RSS-Р»РµРЅС‚ Рё СЃРѕС…СЂР°РЅРµРЅРёСЏ РІ Р±Р°Р·Сѓ РґР°РЅРЅС‹С….
   * Р РѕСѓС‚: POST /ingestion/rss
   * РўСЂРµР±СѓРµС‚ Р·Р°РіРѕР»РѕРІРѕРє x-ingestion-token (СЃРј. INGESTION_TOKEN РІ env).
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
