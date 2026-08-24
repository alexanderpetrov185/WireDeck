import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NewsService } from './news.service';
import { News, NewsStatus } from './entities/news.entity';
import { TokenGuard } from '../../common/guards/token.guard';

/**
 * Read-only News API для Frontend Admin (Sprint 10).
 * Все endpoints защищены существующим TokenGuard (x-ingestion-token).
 *
 * ВАЖНО: статический route /news/stats объявлен ПЕРЕД динамическим /news/:id,
 * чтобы не интерпретироваться как id.
 */
@Controller('news')
@UseGuards(TokenGuard)
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  /**
   * GET /news?limit=&skip=&status=
   * Список новостей с пагинацией и опциональным фильтром по статусу.
   */
  @Get()
  async list(
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
    @Query('status') status?: string,
  ): Promise<News[]> {
    const take = this.resolveLimit(limit);
    const offset = this.resolveSkip(skip);
    const statusFilter = this.resolveStatus(status);

    return this.newsService.findAll(take, offset, statusFilter);
  }

  /**
   * GET /news/stats
   * Реальные количества по каждому существующему статусу.
   * Объявлен ДО /news/:id, чтобы не попадать в динамический route.
   */
  @Get('stats')
  async stats(): Promise<Record<string, number>> {
    const statuses = Object.values(NewsStatus);
    const counts: Record<string, number> = {};

    for (const s of statuses) {
      counts[s] = await this.newsService.countByStatus(s);
    }

    counts['total'] = statuses.reduce((sum, s) => sum + counts[s], 0);
    return counts;
  }

  /**
   * GET /news/:id
   * Полная новость или 404.
   */
  @Get(':id')
  async getOne(@Param('id') id: string): Promise<News> {
    const news = await this.newsService.findById(id);
    if (!news) {
      throw new NotFoundException(`News ${id} not found`);
    }
    return news;
  }

  /**
   * Валидация limit: 1..100, иначе 400.
   */
  private resolveLimit(raw?: number): number {
    if (raw === undefined) {
      return 50;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 100) {
      throw new BadRequestException('limit must be an integer between 1 and 100');
    }
    return parsed;
  }

  /**
   * Валидация skip: >= 0, иначе 400.
   */
  private resolveSkip(raw?: number): number {
    if (raw === undefined) {
      return 0;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestException('skip must be a non-negative integer');
    }
    return parsed;
  }

  /**
   * Валидация status: должен быть существующим NewsStatus, иначе 400.
   */
  private resolveStatus(raw?: string): NewsStatus | undefined {
    if (raw === undefined || raw === '') {
      return undefined;
    }
    if (!Object.values(NewsStatus).includes(raw as NewsStatus)) {
      throw new BadRequestException(`Invalid status "${raw}"`);
    }
    return raw as NewsStatus;
  }
}