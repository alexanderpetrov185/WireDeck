// Контроллер для проверки состояния приложения (Sprint 11: DB + Redis, liveness/readiness)
import { Controller, Get, Inject } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheckError,
  HealthIndicatorResult,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Queue } from 'bullmq';
import { PIPELINE_QUEUE } from '../modules/pipeline/pipeline.queue';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService, // Основной сервис проверки состояния
    private db: TypeOrmHealthIndicator, // Индикатор проверки состояния базы данных
    @Inject(PIPELINE_QUEUE) private readonly queue: Queue, // Существующий BullMQ Queue — Redis client переиспользуется
  ) {}

  // GET /health — полная проверка (DB + Redis через существующий BullMQ connection).
  // Внешние ресурсы НЕ пингуются (Sprint 11: убран ping docs.nestjs.com — false negative offline).
  @Get()
  async check() {
    return this.health.check([
      // Проверка доступности базы данных
      () => this.db.pingCheck('database'),
      // Проверка Redis через существующее подключение BullMQ
      () => this.pingRedis('redis'),
    ]);
  }

  // GET /health/live — liveness: процесс жив и отвечает.
  // Не проверяет зависимости (liveness semantics).
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  // GET /health/ready — readiness: готовы принимать трафик (DB + Redis).
  @Get('ready')
  async ready() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.pingRedis('redis'),
    ]);
  }

  /**
   * Проверка Redis через существующий клиент BullMQ (без второго клиента).
   * Таймаут обязателен: у BullMQ connection maxRetriesPerRequest=null,
   * поэтому при недоступном Redis команда висит в очереди бесконечно.
   */
  private async pingRedis(key: string): Promise<HealthIndicatorResult> {
    const REDIS_PING_TIMEOUT_MS = 2000;
    try {
      const client = await this.queue.client;
      const pong = await Promise.race([
        client.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`redis ping timed out after ${REDIS_PING_TIMEOUT_MS}ms`)), REDIS_PING_TIMEOUT_MS),
        ),
      ]);
      if (pong !== 'PONG') {
        throw new Error(`Unexpected redis PING response: ${String(pong)}`);
      }
      return { [key]: { status: 'up' } };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HealthCheckError(`${key} check failed: ${message}`, {
        [key]: { status: 'down', message },
      });
    }
  }
}
