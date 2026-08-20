import { Controller, Post, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { PublishingService } from './publishing.service';
import { PublishingResult } from './publishing-result.interface';
import { TokenGuard } from '../../common/guards/token.guard';

@Controller('publishing')
export class PublishingController {
  constructor(private readonly publishingService: PublishingService) {}

  /**
   * Публикация одной новости по ID.
   * Роут: POST /publishing/publish/:id
   * Требует заголовок x-ingestion-token (см. INGESTION_TOKEN в env).
   * @param id ID новости
   */
  @Post('publish/:id')
  @UseGuards(TokenGuard)
  @HttpCode(HttpStatus.OK)
  async publishOne(@Param('id') id: string): Promise<PublishingResult> {
    return this.publishingService.publishOne(id);
  }

  /**
   * Пакетная публикация новостей со статусом APPROVED.
   * Роут: POST /publishing/publish-pending
   * Требует заголовок x-ingestion-token (см. INGESTION_TOKEN в env).
   * @param limit Максимум новостей за один прогон
   */
  @Post('publish-pending')
  @UseGuards(TokenGuard)
  @HttpCode(HttpStatus.OK)
  async publishPending(@Query('limit') limit: number = 50): Promise<PublishingResult> {
    return this.publishingService.publishPending(limit);
  }
}
