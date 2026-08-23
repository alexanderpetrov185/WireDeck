import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
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
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('trigger')
  @UseGuards(TokenGuard)
  @HttpCode(HttpStatus.OK)
  async trigger(): Promise<{ enqueued: boolean }> {
    const enqueued = await this.schedulerService.enqueueJob();
    return { enqueued };
  }
}