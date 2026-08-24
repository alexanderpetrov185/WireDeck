import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { PublishingStuckSweeperService } from '../publishing/publishing-stuck-sweeper.service';
import { TokenGuard } from '../../common/guards/token.guard';

/**
 * Ручной запуск pipeline (по требованию).
 * Роут: POST /pipeline/trigger
 * Требует заголовок x-ingestion-token (см. INGESTION_TOKEN в env).
 *
 * Использует тот же дедупликационный enqueueJob, что и scheduler —
 * если job уже активен, новый не создаётся.
 */
@Controller('pipeline')
export class PipelineController {
  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly stuckSweeper: PublishingStuckSweeperService,
  ) {}

  @Post('trigger')
  @UseGuards(TokenGuard)
  @HttpCode(HttpStatus.OK)
  async trigger(): Promise<{ enqueued: boolean }> {
    const enqueued = await this.schedulerService.enqueueJob();
    return { enqueued };
  }

  /**
   * Ручная диагностика застрявших публикаций (Sprint 11).
   * Роут: GET /pipeline/stuck
   * Требует заголовок x-ingestion-token.
   * Только чтение — восстановление вручную по docs/FAILURE_MODES.md.
   */
  @Get('stuck')
  @UseGuards(TokenGuard)
  async stuck(): Promise<{
    count: number;
    items: Array<{ id: string; updatedAt: string }>;
    note: string;
  }> {
    const items = await this.stuckSweeper.getStuck();
    return {
      count: items.length,
      items,
      note: 'Detection only. Manual recovery required (docs/FAILURE_MODES.md). Auto-republish may create Telegram duplicates.',
    };
  }
}