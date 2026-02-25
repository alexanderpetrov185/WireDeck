// Контроллер метрик Prometheus
// Предоставляет эндпоинт /metrics для сбора метрик

import { Controller, Get, Res, Header } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller('metrics')
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
