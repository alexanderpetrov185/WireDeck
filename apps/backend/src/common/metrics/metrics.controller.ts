// Контроллер метрик Prometheus
// Предоставляет эндпоинт /metrics для сбора метрик
// Sprint 11 cleanup: защищён TokenGuard — метрики не отдаются без токена.
import { Controller, Get, Res, Header, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';
import { TokenGuard } from '../guards/token.guard';

@Controller('metrics')
@UseGuards(TokenGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  // Эндпоинт для сбора метрик Prometheus
  @Get()
  @Header('Content-Type', 'text/plain')
  async getMetrics(@Res() res: Response) {
    const metrics = await this.metricsService.getMetrics();
    res.send(metrics);
  }
}

