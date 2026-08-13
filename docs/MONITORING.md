# Monitoring & Logging Guide

## Обзор

Проект использует следующий стек для мониторинга и логирования:

| Компонент | Назначение | Порт |
|-----------|------------|------|
| **Sentry** | Отслеживание ошибок | - |
| **Prometheus** | Сбор и хранение метрик | 9090 |
| **Grafana** | Визуализация метрик и логов | 3002 |
| **Loki** | Агрегация логов | 3100 |
| **Promtail** | Сбор и отправка логов в Loki | - |
| **Winston** | Логирование в приложениях | - |

## Быстрый старт

### 1. Запуск стека мониторинга

```bash
# Запуск Prometheus, Grafana, Loki и Promtail
docker compose -f infra/docker/docker-compose.monitoring.yml up -d
```

### 2. Доступ к интерфейсам

- **Grafana**: http://localhost:3002
  - Логин: `admin`
  - Пароль: `admin123`

- **Prometheus**: http://localhost:9090

### 3. Запуск приложения с метриками

```bash
# Backend будет доступен на http://localhost:3000/metrics
npm run dev:backend
```

## Настройка Sentry

### 1. Регистрация на Sentry

1. Перейдите на [sentry.io](https://sentry.io)
2. Создайте организацию и проект
3. Получите DSN для backend и frontend

### 2. Настройка переменных окружения

```bash
# .env файл в корне проекта
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=wiredeck
SENTRY_PROJECT=backend
SENTRY_AUTH_TOKEN=sntrys_xxx
```

### 3. Использование в коде

**Backend (NestJS):**
```typescript
import { captureException, setSentryUser } from './common/sentry/sentry.config';

// В сервисе или контроллере
try {
  // Ваш код
} catch (error) {
  captureException(error, { context: 'UserService' });
  throw error;
}

// Установка пользователя для отслеживания
setSentryUser(userId, email);
```

**Frontend (Next.js):**
```typescript
import { captureClientException, setClientUser } from './lib/sentry/sentry.client';

// В компоненте
try {
  // Ваш код
} catch (error) {
  captureClientException(error, { component: 'MyComponent' });
}

// Установка пользователя
setClientUser(userId, email);
```

## Логирование

### Backend (Winston)

Логи записываются в:
- Консоль (development/production)
- Файлы `logs/application-YYYY-MM-DD.log` (production)
- Файлы `logs/error-YYYY-MM-DD.log` (production, только ошибки)

**Использование:**
```typescript
import { LoggerService } from './common/logger/logger.service';

// В сервисе через DI
constructor(private logger: LoggerService) {}

// Логирование
this.logger.log('Сообщение', 'MyContext');
this.logger.error('Ошибка', stackTrace, 'MyContext');
this.logger.warn('Предупреждение', 'MyContext');
this.logger.debug('Отладочная информация', 'MyContext');
```

### Frontend

**Использование:**
```typescript
import { logger, createContextLogger } from './lib/logger/logger.config';

// Серверное логирование
logger.info('Сообщение', { context: 'MyComponent' });

// Клиентское логирование
import { clientLogger } from './lib/logger/logger.config';
clientLogger.info('Действие пользователя', { userId: '123' });
```

## Метрики Prometheus

### Доступные метрики

| Метрика | Описание | Тип |
|---------|----------|-----|
| `http_requests_total` | Всего HTTP запросов | Counter |
| `http_request_duration_seconds` | Длительность HTTP запросов | Histogram |
| `database_query_duration_seconds` | Длительность запросов к БД | Histogram |
| `database_errors_total` | Всего ошибок БД | Counter |
| `queue_jobs_total` | Всего обработанных задач очереди | Counter |
| `queue_job_duration_seconds` | Длительность обработки задач | Histogram |
| `queue_size` | Размер очереди | Gauge |
| `app_info` | Информация о приложении | Gauge |

### Использование в коде

```typescript
import { MetricsService } from './common/metrics/metrics.service';

// В сервисе через DI
constructor(private metrics: MetricsService) {}

// Наблюдение за HTTP запросом
this.metrics.observeHttpRequest('GET', '/api/users', 200, 0.123);

// Наблюдение за запросом к БД
this.metrics.observeDatabaseQuery('SELECT', 0.045);

// Логирование ошибки БД
this.metrics.logDatabaseError('connection_timeout');

// Наблюдение за задачей очереди
this.metrics.observeQueueJob('news-queue', 'parse-news', 'completed', 2.5);

// Обновление размера очереди
this.metrics.updateQueueSize('news-queue', 42);
```

### Эндпоинт метрик

Метрики доступны по адресу: `http://localhost:3000/metrics`

## Grafana Дашборды

### Встроенные дашборды

1. **WireDeck - Backend Metrics**
   - HTTP Requests Rate
   - HTTP Request Duration (95th percentile)
   - Queue Size
   - Database Errors Rate
   - CPU Idle
   - Available Memory

### Добавление нового дашборда

1. Откройте Grafana: http://localhost:3002
2. Перейдите в Dashboards → New Dashboard
3. Добавьте панели с нужными метриками
4. Сохраните дашборд

### Импорт дашборда из файла

Дашборды автоматически загружаются из:
`infra/docker/grafana/provisioning/dashboards/`

## Loki Логи

### Поиск логов в Grafana

1. Откройте Grafana: http://localhost:3002
2. Перейдите в Explore
3. Выберите datasource: Loki
4. Используйте Label Filter: `{job="wiredeck"}`

### Примеры запросов

```
# Все логи приложения
{job="wiredeck"}

# Только ошибки
{job="wiredeck"} |= "level" |= "error"

# Логи конкретного контекста
{job="wiredeck"} | json | context="HealthController"

# Логи за последний час
{job="wiredeck"} | json | level="error" | line_format "{{.timestamp}} {{.message}}"
```

## Алёртинг

### Настройка алертов в Grafana

1. Откройте дашборд
2. Нажмите на панель → Edit
3. Alerts → Create Alert
4. Настройте условия:
   - Query: `database_errors_total`
   - Condition: `IS ABOVE 0`
   - For: `5m`
5. Настройте уведомления (Email, Slack)

### Пример алерта на ошибки БД

```yaml
# infra/docker/prometheus/alerts.yml
groups:
  - name: database-alerts
    rules:
      - alert: HighDatabaseErrorRate
        expr: rate(database_errors_total[5m]) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High database error rate detected"
          description: "Database error rate is {{ $value }} errors per second"
```

## Переменные окружения

Все переменные для мониторинга находятся в `.env`:

```bash
# Sentry
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=wiredeck
SENTRY_PROJECT=backend
SENTRY_AUTH_TOKEN=

# Логирование
LOG_LEVEL=info

# Grafana
GRAFANA_PORT=3002
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin123
```

## Troubleshooting

### Prometheus не видит метрики

1. Проверьте, что backend доступен: `curl http://localhost:3000/metrics`
2. Проверьте конфигурацию `prometheus.yml`
3. Проверьте логи Prometheus: `docker logs wiredeck-prometheus`

### Grafana не показывает данные

1. Проверьте datasource Prometheus в Grafana
2. Убедитесь, что Prometheus собирает метрики
3. Проверьте временной диапазон на дашборде

### Loki не получает логи

1. Проверьте конфигурацию Promtail: `docker logs wiredeck-promtail`
2. Убедитесь, что файлы логов существуют
3. Проверьте права доступа к файлам логов

### Sentry не отправляет ошибки

1. Проверьте DSN в переменных окружения
2. Проверьте sample rate (tracesSampleRate)
3. Проверьте консоль на ошибки инициализации

## Дополнительные ресурсы

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [Sentry Documentation](https://docs.sentry.io/)
- [Winston Documentation](https://github.com/winstonjs/winston)
