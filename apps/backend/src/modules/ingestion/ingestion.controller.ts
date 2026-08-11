import { Controller, Post, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { IngestionService, IngestionResult } from './ingestion.service';
import { IngestionGuard } from './ingestion.guard';

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  /**
   * Ручной запуск сбора новостей из RSS-лент и сохранения в базу данных.
   * Роут: POST /ingestion/rss
   * Требует заголовок x-ingestion-token (см. INGESTION_TOKEN в env).
   * @param since Опциональная дата фильтрации (например: 2026-08-11T00:00:00Z)
   */
  @Post('rss')
  @UseGuards(IngestionGuard)
  @HttpCode(HttpStatus.OK)
  async runRssIngestion(@Query('since') since?: string): Promise<IngestionResult> {
    const sinceDate = since ? new Date(since) : undefined;
    // Если дата некорректная, игнорируем ее
    const validSinceDate = sinceDate && !isNaN(sinceDate.getTime()) ? sinceDate : undefined;

    return this.ingestionService.ingestFromRss(validSinceDate);
  }
}
