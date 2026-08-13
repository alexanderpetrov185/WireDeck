# WireDeck — Development Roadmap

## Sprint Status

| Sprint | Name | Description | Status |
|--------|------|-------------|--------|
| Sprint 1 | Collector (foundation) | Базовая архитектура и DI | DONE |
| Sprint 2 | RSS Collector | RSS-коллектор | DONE |
| Sprint 3 | Ingestion | Связка Collector и persistence, dedup | DONE |
| Sprint 4 | Deduplication + Migrations + Hardening | Hash-dedup, миграции, защита | DONE |
| Sprint 5 | AI Processing | Суммаризация, классификация, скоринг | DONE |
| Sprint 6 | Translation | Перевод на target language (EN default) | DONE |
| Sprint 7 | Moderation | UI одобрения/отклонения новостей | NOT STARTED |
| Sprint 8 | Publishing | Публикация в каналы | NOT STARTED |
| Sprint 9 | Scheduler + BullMQ | Планировщик задач, очереди | NOT STARTED |
| Sprint 10 | Frontend Admin | Админ-панель для модерации | NOT STARTED |
| Sprint 11 | Reliability + Production Readiness | Health, graceful shutdown, tracing | NOT STARTED |

## Завершённые спринты

### Sprint 6 — Translation (DONE)
- TranslationModule с DI через токен TRANSLATION_PROVIDER.
- TranslationService: single + batch режимы, force перевод, idempotency.
- TranslationController: POST /translation/run, POST /translation/run/:id (TokenGuard).
- OpenAiTranslationProvider: HTTP-клиент к OpenAI-compatible endpoint.
- Pipeline: PROCESSED -> TRANSLATED (перевод summary).
- Default target language: EN (TRANSLATION_TARGET_LANGUAGE=en).
- 18 unit-тестов (service + provider).
- Зафиксировано в ARCHITECTURE.md и MODULE_BOUNDARIES.md.

### Sprint 5 — AI Processing (DONE)
- AiProcessingModule / AiProcessingService / AiProcessingController.
- OpenAiProvider через DI токен AI_PROVIDER.
- Pipeline: RAW -> PROCESSED (суммаризация, классификация, скоринг).

## Планируемые спринты

### Sprint 7 — Moderation
- UI для одобрения/отклонения новостей.
- Статусы QUEUED -> APPROVED / REJECTED.
- moderatedBy, moderatedAt, rejectionReason (уже в entity).

### Sprint 8 — Publishing
- Публикация одобренных новостей в каналы.
- Поле telegramMessageId (канал публикации) — уже в entity.

### Sprint 9 — Scheduler + BullMQ
- Планировщик для периодического запуска коллекторов, AI Processing и Translation.
- BullMQ + Redis (зависимости уже в package.json, но не используются в коде).

### Sprint 10 — Frontend Admin
- Next.js админ-панель для модерации и мониторинга.

### Sprint 11 — Reliability + Production Readiness
- Graceful shutdown, health checks, tracing, Sentry source maps.
