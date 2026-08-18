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
- **Архитектурные ограничения:** обрабатывает **только** `PROCESSED`; ставит статус `TRANSLATED`.
- **DI:** провайдер регистрируется через токен `TRANSLATION_PROVIDER`.
- **Idempotency:** повторный запуск для `TRANSLATED` без `force` — скип.
- **Endpoint'ы:** `POST /translation/run` (batch), `POST /translation/run/:id` (single).

### 3.6 Content Enrichment (планируется)
- **Назначение:** обогащение контента перед публикацией (теги, ссылки, форматирование).
- **Статус:** планируется в будущих спринтах.

### 3.7 Monitoring (`src/common/`)
- **Sentry:** `initSentry`, `captureException`, `captureMessage`, `setSentryContext`, `setSentryUser`.
- **Logger:** `LoggerService` (Winston).
- **Metrics:** `MetricsService` + Prometheus (`/metrics` endpoint).

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
Content Enrichment       (ещё не реализован)
  ↓
Publishing               (ещё не реализован)
  ↓
Telegram channel
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
- **Кеш/очереди:** Redis (`REDIS_URL`).
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
