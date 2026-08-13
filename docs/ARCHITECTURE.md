# WireDeck — Architecture Documentation

## 1. Назначение проекта

**WireDeck** — универсальная платформа для агрегации, обработки, анализа, перевода,
модерации и публикации новостей.

WireDeck НЕ является:
- Crypto News Bot
- Telegram Bot
- агрегатором **только** криптовалютных новостей

**Crypto** является лишь одним из многих источников данных.

Поддерживаемые домены: `finance`, `markets`, `business`, `economy`, `technology`, `crypto`.

## 2. Цели проекта

1. Собирать новости из разнородных источников (RSS, Twitter/X, NewsAPI, Google News,
   Binance, CoinGecko и др.).
2. Выполнять дедупликацию и нормализацию.
3. Применять AI-обработку (суммаризация, классификация, скоринг).
4. Переводить контент на целевые языки.
5. Обеспечивать модерацию и публикацию в каналы.
6. Обеспечивать наблюдаемость (Sentry, Prometheus, Grafana, Loki).

## 3. Описание модулей

### 3.1 Collector (`src/modules/collector/`)
- **Назначение:** сбор сырой информации из внешних источников.
- **Реализации:** `RssCollector`, `TwitterCollector`, `NewsApiCollector`,
  `GoogleNewsCollector`, `BinanceCollector`, `CoinGeckoCollector`.
- **Архитектурные ограничения:**
  - не зависит от TypeORM;
  - не зависит от `NewsModule`;
  - возвращает **только** `CollectedNews[]`.
- **DI:** все коллекторы регистрируются через токен `NEWS_COLLECTORS` в `CollectorModule`.

### 3.2 Ingestion (`src/modules/ingestion/`)
- **Назначение:** связывает `Collector` и persistence; выполняет дедупликацию.
- **Защита:** `TokenGuard` через заголовок `x-ingestion-token` (`INGESTION_TOKEN`).
- **Архитектурные ограничения:** не знает внутреннего устройства коллекторов.
- **Дедупликация:** через `hash` (SHA-256 нормализованного текста, `news-hash.util.ts`).

### 3.3 News / Domain (`src/modules/news/`)
- **Назначение:** доменная модель (`News` entity), статусы, источники, языки.
- **Entity:** `apps/backend/src/modules/news/entities/news.entity.ts`.

### 3.4 AI Processing (`src/modules/ai-processing/`)
- **Назначение:** суммаризация, классификация, скоринг.
- **Архитектурные ограничения:** обрабатывает **только** `RAW`; ставит статус `PROCESSED`.

### 3.5 Translation (`src/modules/translation/`)
- **Назначение:** перевод `summary` на целевой язык.
- **Архитектурные ограничения:** обрабатывает **только** `PROCESSED`; ставит статус `TRANSLATED`.
- **DI:** провайдер регистрируется через токен `TRANSLATION_PROVIDER`.
- **Idempotency:** повторный запуск для `TRANSLATED` без `force` — скип.
- **Endpoint'ы:** `POST /translation/run` (batch), `POST /translation/run/:id` (single).

### 3.6 Monitoring (`src/common/`)
- **Sentry:** `initSentry`, `captureException`, `captureMessage`, `setSentryContext`, `setSentryUser`.
- **Logger:** `LoggerService` (Winston).
- **Metrics:** `MetricsService` + Prometheus (`/metrics` endpoint).

## 4. Архитектурные ограничения

- **Collector → запрещено** импортировать `NewsService` / TypeORM.
- **AI Processing → запрещено** импортировать `Collector`.
- **Translation → запрещено** импортировать `Collector`.
- **Frontend → запрещено** импортировать backend-код.
- Модули общаются только через интерфейсы и DI-токены.

## 5. Жизненный цикл новости (News Lifecycle)

```
Sources
  ↓
Collectors
  ↓
CollectedNews[]          (чистый DTO, без сущности БД)
  ↓
Ingestion                (DEDUP через hash / source+sourceId)
  ↓
News [status = RAW]
  ↓
AI Processing            (только RAW → PROCESSED)
  ↓
News [status = PROCESSED]
  ↓
Translation              (только PROCESSED → TRANSLATED, EN default)
  ↓
News [status = TRANSLATED]
  ↓
Moderation               (ещё не реализован)
  ↓
Publishing               (ещё не реализован)
```

### Транзиции статусов

| From      | To          | Кто делает       |
|-----------|-------------|------------------|
| RAW       | PROCESSED   | AI Processing     |
| PROCESSED | TRANSLATED  | Translation       |
| TRANSLATED| TRANSLATED  | Translation (force) |
| TRANSLATED| QUEUED      | Moderation (Sprint 7) |
| QUEUED    | APPROVED    | Moderation (Sprint 7) |
| QUEUED    | REJECTED    | Moderation (Sprint 7) |
| APPROVED  | PUBLISHED   | Publishing (Sprint 8) |

## 6. Языковая политика

- **Английский (`en`) — язык по умолчанию.**
- `TRANSLATION_TARGET_LANGUAGE=en` (см. `.env.example`).
- Архитектура **расширяема**: `NewsLanguage` enum (EN/RU/UZ) + валидация в
  `TranslationController.resolveTargetLanguage`.
- Планируемые языки: `EN`, `RU`, `UZ`, `ES`, `DE`.
- Проект **не привязан** к узбекскому языку.
- **Запрещено** добавлять новые миграции или менять схему БД в этом спринте.

## 7. Слой данных

- **ORM:** TypeORM.
- **База:** PostgreSQL (`DB_*` env vars).
- **Кеш/очереди:** Redis (`REDIS_URL`).
- **Миграции:** `src/database/migrations/`; `data-source.ts` — конфиг.

## 8. Инфраструктура

```
infra/docker/
├── docker-compose.monitoring.yml   # Prometheus, Grafana, Loki, Promtail
├── Dockerfile              (apps/backend)
└── compose.yaml            (корневой: backend, frontend, redis, postgres)
```

- CI/CD: `.github/workflows/` (lint, test, build, docker).
- Sentry DSN, API ключи через переменные окружения (`.env`).

## 9. Roadmap

| Sprint | Название                          | Статус |
|--------|-----------------------------------|--------|
| 1      | Collector (foundation)            | ✅ |
| 2      | RSS Collector                     | ✅ |
| 3      | Ingestion                         | ✅ |
| 4      | Deduplication + Migrations + Hardening | ✅ |
| 5      | AI Processing                     | ✅ |
| 6      | Translation                       | ✅ |
| 7      | Moderation                        | 🚧 (не реализована) |
| 8      | Publishing                        | 🚧 (не реализована) |
| 9      | Scheduler + BullMQ                | 🔜 |
| 10     | Frontend Admin                    | 🔜 |
| 11     | Reliability + Production Readiness| 🔜 |
