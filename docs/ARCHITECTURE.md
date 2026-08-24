# WireDeck — Architecture Documentation

## 1. Назначение проекта

**WireDeck** — AI-управляемая система обработки финансовых новостей.

**Telegram** является центральной платформой доставки контента.

Финальный бизнес-пайплайн:

```
Sources
→ Collectors
→ Ingestion
→ Deduplication
→ AI Processing
→ Translation
→ Moderation
→ Content Enrichment
→ Publishing
→ Telegram channel
```

WireDeck НЕ является универсальной платформой публикации.

Поддерживаемые домены: `finance`, `markets`, `business`, `economy`, `technology`, `crypto`.

## 2. Цели проекта

1. Собирать новости из разнородных источников (RSS, Twitter/X, NewsAPI, Google News,
   Binance, CoinGecko и др.).
2. Выполнять дедупликацию и нормализацию.
3. Применять AI-обработку (суммаризация, классификация, скоринг).
4. Переводить контент на целевые языки.
5. Обеспечивать модерацию и публикацию в Telegram-канал.
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
- **Enums:** `NewsSource` и `NewsLanguage` вынесены в `constants/` для использования
  модулями без импорта TypeORM-сущностей.

### 3.4 AI Processing (`src/modules/ai-processing/`)
- **Назначение:** суммаризация, классификация, скоринг.
- **Архитектурные ограничения:** обрабатывает **только** `RAW`; ставит статус `PROCESSED`.

### 3.5 Translation (`src/modules/translation/`)
- **Назначение:** перевод `summary` на целевой язык.
- **Архитектурные ограничения:** обрабатывает **только** `PROCESSED`.
- **Статус после перевода:** в основном pipeline ставится `QUEUED`
  (новость сразу попадает в очередь модерации). Статус `TRANSLATED` существует
  в enum и используется force-переводом, но не является основным потоком.
- **DI:** провайдер регистрируется через токен `TRANSLATION_PROVIDER`.
- **Idempotency:** повторный запуск для `QUEUED`/`APPROVED`/`PUBLISHED` без `force` — скип.
- **Endpoint'ы:** `POST /translation/run` (batch), `POST /translation/run/:id` (single).

### 3.6 Content Enrichment
- **НЕ реализован и не входит в текущий roadmap.**
  Обогащение контента (теги, ссылки, форматирование) — потенциальное будущее направление.

### 3.7 Moderation (`src/modules/moderation/`) — Sprint 7
- **Назначение:** QUEUED → APPROVED / REJECTED; batch auto-approve (`approvePending`).
- Ручное: `POST /moderation/approve/:id?moderator=`, `POST /moderation/reject/:id?moderator=&reason=`
  (TokenGuard). Audit: `moderatedBy`, `moderatedAt`, `rejectionReason`.

### 3.8 Publishing (`src/modules/publishing/`) — Sprint 8/8.5
- **Назначение:** APPROVED → PUBLISHED → Telegram channel (Telegram-centric).
- Atomic claim (conditional UPDATE), Telegram send, markPublished;
  revert claim при ошибке Telegram (только если message_id ещё пуст).
- Stuck detection (Sprint 11): sweeper + метрика `publishing_stuck_news` +
  `GET /pipeline/stuck`. Auto-recovery НЕ выполняется (риск дублей) — см. docs/FAILURE_MODES.md.
- Провайдер: Telegram Bot API (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`).

### 3.7 Monitoring (`src/common/`)
- **Sentry:** `initSentry`, `captureException`, `captureMessage`, `setSentryContext`, `setSentryUser`.
- **Logger:** `LoggerService` (Winston).
- **Metrics:** `MetricsService` + Prometheus (`/metrics` endpoint, TokenGuard).
- **Health:** `/health` (DB+Redis), `/health/live`, `/health/ready` (Sprint 11).

### 3.9 Frontend Admin (`apps/frontend/`) — Sprint 10
- Next.js App Router; BFF Route Handlers `src/app/api/admin/*` проксируют backend,
  добавляя `x-ingestion-token` server-side (`lib/server/backend-client.ts`).
- Browser не обращается к backend напрямую; INGESTION_TOKEN не попадает в client bundle.
- Страницы: Dashboard, News list, News details, Moderation.

### 3.8 Pipeline / Scheduler (`src/modules/pipeline/`) — Sprint 9
- **Назначение:** автоматический запуск существующего pipeline через BullMQ + Redis.
- **SchedulerService:** периодический запуск (SCHEDULER_ENABLED, PIPELINE_INTERVAL_MS);
  дедупликация через фиксированный jobId (active/waiting → skip; completed/failed → новый job).
- **PipelineService:** оркестрация Ingestion → AI Processing → Translation → Moderation → Publishing.
  Ошибки отдельных шагов изолированы и не останавливают остальные pending-based шаги.
- **PipelineProcessor:** BullMQ Worker handler; job-level необработанные ошибки → BullMQ retry.
- **Очередь:** `wiredeck-pipeline`; конфигурация: concurrency=1, attempts, exponential backoff.
- **Ручной запуск:** `POST /pipeline/trigger` (TokenGuard).
- **Значения env:** `SCHEDULER_ENABLED=false`, `PIPELINE_INTERVAL_MS=600000`, `PIPELINE_BATCH_LIMIT=50`.

## 4. Архитектурные ограничения

- **Collector → запрещено** импортировать `NewsService` / TypeORM.
- **AI Processing → запрещено** импортировать `Collector`.
- **Translation → запрещено** импортировать `Collector`.
- **Frontend → запрещено** импортировать backend-код.
- Модули общаются только через интерфейсы и DI-токены.

## 5. Architecture Freeze Rules

Следующие модули считаются **стабильными**:

- **Collector** (`src/modules/collector/`)
- **Ingestion** (`src/modules/ingestion/`)
- **AI Processing** (`src/modules/ai-processing/`)
- **Translation** (`src/modules/translation/`)
- **Monitoring** (`src/common/`)

Любые изменения в этих модулях требуют:

1. **Архитектурный ревью** — обязательная оценка влияния на существующие модули
   и бизнес-пайплайн.
2. **Обновление документации** — `ARCHITECTURE.md`, `MODULE_BOUNDARIES.md`
   должны быть обновлены синхронно с кодом.
3. **Явное одобрение** — изменение не может быть замержено без подтверждения
   владельца архитектуры.

Исключения из freeze: исправление критических багов и security-уязвимостей
(с последующим полным обновлением документации).

## 6. Защита проектной документации

Следующие документы считаются **единственным источником правды**
(single source of truth) для проекта WireDeck:

- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/MODULE_BOUNDARIES.md`

**`docs/ROADMAP.md` НЕ ДОЛЖЕН изменяться автоматически** в процессе реализации
будущих фич. Изменения в Roadmap вносятся только осознанным решением
владельца проекта/архитектора.

## 7. Жизненный цикл новости (News Lifecycle)

```
Sources (RSS)
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
Translation              (PROCESSED → QUEUED, translatedText пишется сразу, EN default)
  ↓
News [status = QUEUED]
  ↓
Moderation               (QUEUED → APPROVED / REJECTED; batch auto-approve + ручная модерация)
  ↓
Publishing               (APPROVED → PUBLISHED → Telegram; atomic claim)
  ↓
Telegram channel

Content Enrichment: НЕ реализован и не входит в текущий roadmap.
Статус TRANSLATED существует в enum (force-перевод), но основной поток: processed → queued.
```

### Транзиции статусов (фактические)

| From      | To          | Кто делает       |
|-----------|-------------|------------------|
| —         | RAW         | Ingestion        |
| RAW       | PROCESSED   | AI Processing     |
| PROCESSED | QUEUED      | Translation (основной поток) |
| PROCESSED | PROCESSED   | Translation (skip без изменений) |
| QUEUED    | APPROVED    | Moderation (batch auto + ручное approve) |
| QUEUED    | REJECTED    | Moderation (reject с reason) |
| APPROVED  | PUBLISHED   | Publishing (atomic claim) |
| PUBLISHED | APPROVED    | Publishing revert (только при ошибке Telegram и пустом message_id) |

## 8. Языковая политика

- **Английский (`en`) — язык по умолчанию.**
- Модель перевода: `sourceLanguage → translatedText`.
- Примеры: `ru → translatedText (en)`, `de → translatedText (en)`, `fr → translatedText (en)`.
- Архитектура **расширяема**: в будущем `sourceLanguage → translatedText (uz)`,
  `sourceLanguage → translatedText (es)`, `sourceLanguage → translatedText (tr)`.
- **Запрещено** добавлять `targetLanguage` поле, сущности перевода, дополнительные таблицы,
  JSONB или миграции БД для расширения языковой поддержки.
- Текущая архитектура перевода остаётся неизменной.

## 9. Слой данных

- **ORM:** TypeORM.
- **База:** PostgreSQL (`DB_*` env vars).
- **Кеш/очереди:** Redis (`REDIS_HOST` / `REDIS_PORT`; BullMQ connection).
- **Миграции:** `src/database/migrations/`; `data-source.ts` — конфиг.

## 10. Инфраструктура

```
infra/docker/
├── docker-compose.monitoring.yml   # Prometheus, Grafana, Loki, Promtail
├── Dockerfile              (apps/backend)
└── compose.yaml            (корневой: backend, frontend, redis, postgres)
```

- CI/CD: `.github/workflows/` (lint, test, build, docker).
- Sentry DSN, API ключи через переменные окружения (`.env`).

## 11. Roadmap

| Sprint | Название                          | Статус |
|--------|-----------------------------------|--------|
| 1      | Collector (foundation)            | ✅ |
| 2      | RSS Collector                     | ✅ |
| 3      | Ingestion                         | ✅ |
| 4      | Deduplication + Migrations + Hardening | ✅ |
| 5      | AI Processing                     | ✅ |
| 6      | Translation                       | ✅ |
| 7      | Moderation                        | 🚧 (не реализована) |
| 8      | Publishing (Telegram)             | 🚧 (не реализована) |
| 9      | Scheduler + BullMQ                | 🔜 |
| 10     | Frontend Admin                    | 🔜 |
| 11     | Reliability + Production Readiness| 🔜 |
