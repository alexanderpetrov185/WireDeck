// Контроллер для проверки состояния приложения
import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HttpHealthIndicator, TypeOrmHealthIndicator } from '@nestjs/terminus';

// Контроллер обрабатывает запросы к эндпоинту /health
@Controller('health')
export class HealthController {
  // Конструктор внедряет сервисы для проверки состояния
  constructor(
    private health: HealthCheckService, // Основной сервис проверки состояния
    private http: HttpHealthIndicator, // Индикатор для проверки HTTP ресурсов
    private db: TypeOrmHealthIndicator, // Индикатор для проверки состояния базы данных
  ) {}

  // GET запрос к /health для проверки состояния приложения
  @Get()
  async check() {
    // Возвращает результат проверки состояния сервисов
    return this.health.check([
      // Проверка доступности базы данных
      () => this.db.pingCheck('database'),
      // Проверка доступности внешнего ресурса (документация NestJS)
      () => this.http.pingCheck('nestjs-docs', 'https://docs.nestjs.com'),
    ]);
  }
}