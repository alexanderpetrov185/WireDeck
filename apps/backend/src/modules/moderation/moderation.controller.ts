import { Controller, Post, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { ModerationResult } from './moderation-result.interface';
import { TokenGuard } from '../../common/guards/token.guard';

@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  /**
   * Одобрение одной новости.
   * Роут: POST /moderation/approve/:id
   * Требует заголовок x-ingestion-token (см. INGESTION_TOKEN в env).
   * @param id ID новости
   * @param moderator Имя/ID модератора (query param)
   */
  @Post('approve/:id')
  @UseGuards(TokenGuard)
  @HttpCode(HttpStatus.OK)
  async approveOne(
    @Param('id') id: string,
    @Query('moderator') moderator: string,
  ): Promise<ModerationResult> {
    return this.moderationService.approveOne(id, moderator);
  }

  /**
   * Отклонение одной новости.
   * Роут: POST /moderation/reject/:id
   * Требует заголовок x-ingestion-token (см. INGESTION_TOKEN в env).
   * @param id ID новости
   * @param moderator Имя/ID модератора (query param)
   * @param reason Причина отклонения (query param, обязательна)
   */
  @Post('reject/:id')
  @UseGuards(TokenGuard)
  @HttpCode(HttpStatus.OK)
  async rejectOne(
    @Param('id') id: string,
    @Query('moderator') moderator: string,
    @Query('reason') reason: string,
  ): Promise<ModerationResult> {
    return this.moderationService.rejectOne(id, moderator, reason);
  }
}