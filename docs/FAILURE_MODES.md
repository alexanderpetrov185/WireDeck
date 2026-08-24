# WireDeck — Failure Modes Runbook (Sprint 11)

Документ описывает известные failure modes production pipeline, способы их
детекции и ручного восстановления. Sprint 11 добавляет **только detection/observability** —
автоматическое восстановление не выполняется там, где оно может создать дубликаты.

---

## FM-1: Stuck publishing — crash между claim и Telegram publish

**Контекст (Sprint 8.5):** `PublishingService.publishOne` работает так:

1. Атомарный claim: conditional UPDATE `APPROVED → PUBLISHED`
2. Вызов Telegram API (`publisher.publish`)
3. Запись `telegram_message_id` в БД (`markPublished`)

Если процесс падает (crash/OOM/restart) между шагами 1 и 2, новость остаётся
в статусе `PUBLISHED` с пустым `telegram_message_id`. Повторная публикация
невозможна штатно: `publishPending` ищет только `APPROVED`.

**Почему НЕ auto-recovery:** после crash неизвестно, было ли сообщение реально
отправлено в Telegram до падения. Автоматический revert в `APPROVED` + повторная
публикация может создать **дубль в канале**. Поэтому — только detection.

**Детекция (реализовано в Sprint 11):**
- Метрика `publishing_stuck_news` (gauge) — количество записей
  `PUBLISHED AND telegram_message_id IS NULL AND updated_at < now() - threshold`
- Периодический sweeper: `PublishingStuckSweeperService`
  (env: `PUBLISHING_STUCK_SWEEP_INTERVAL_MS`, дефолт 10 мин;
  порог: `PUBLISHING_STUCK_THRESHOLD_MS`, дефолт 1 час)
- Логи: `STUCK PUBLISHING detected: news <id> ...` (ERROR)
- Sentry message при каждом обнаружении
- Ручная диагностика: `GET /pipeline/stuck` (заголовок `x-ingestion-token`)

**Ручное восстановление (runbook):**
1. `GET /pipeline/stuck` — получить список ID.
2. Для каждого ID проверить в Telegram-канале, было ли сообщение опубликовано
   (поиск по заголовку/тексту новости).
3. Если сообщение ЕСТЬ в канале → вручную записать `telegram_message_id`
   в БД (news остаётся `PUBLISHED`, дубля не будет):
   ```sql
   UPDATE news SET telegram_message_id = '<real_message_id>' WHERE id = '<id>';
   ```
4. Если сообщения НЕТ в канале → безопасно вернуть в `APPROVED`:
   pipeline повторно опубликует его на следующем прогоне:
   ```sql
   UPDATE news SET status = 'approved' WHERE id = '<id>';
   ```

**Мониторинг:** алертить на `publishing_stuck_news > 0`.

---

## FM-2: Stalled BullMQ job

**Симптом:** worker потерял lock на job (restart, GC pause, сетевой сбой).

**Детекция (Sprint 11):**
- Счётчик `queue_jobs_stalled_total{queue_name}`
- Лог `Pipeline job <id> stalled (lock lost)` (WARN)

**Поведение:** BullMQ сам возвращает job в обработку (retry policy не менялась).
Действие оператора: если stalled повторяется часто — проверить стабильность
Redis-соединения и нагрузку на контейнер backend.

---

## FM-3: Redis недоступен

**Симптом:** queue/worker ошибки в логах (`Pipeline queue error`, `Pipeline worker error`),
`/health/ready` возвращает 503 с `redis: down`.

**Детекция (Sprint 11):**
- `/health` и `/health/ready` проверяют Redis через существующий BullMQ connection (`PING`)
- Gauges `queue_job_counts{state}` перестают обновляться

**Действие:** восстановить Redis (`docker compose up -d redis`).
BullMQ переподключается автоматически; scheduler продолжит enqueue после восстановления.

---

## FM-4: Сбой отдельного шага pipeline

**Симптом:** метрика `queue_jobs_total{queue_name="wiredeck-pipeline",job_name="<step>",status="failed"}`
растёт; в логах `Pipeline step "<step>" failed`; exception уходит в Sentry.

**Поведение:** ошибка одного шага не останавливает остальные шаги прогона
(`safeStep`). Job-level BullMQ retry (attempts=3, exponential backoff) применяется
только к необработанным исключениям самого job.

**Действие:** смотреть Sentry (тег/контекст `pipelineStep`) и Winston-логи.

---

## FM-5: Telegram publish error (без crash)

**Симптом:** `Failed to publish news <id>` (ERROR), errors:1 в PublishingResult.

**Поведение (Sprint 8.5):** claim автоматически откатывается (`PUBLISHED → APPROVED`,
только если telegram_message_id ещё пуст) — новость будет повторно опубликована
на следующем прогоне без дублей.

**Действие:** проверить TELEGRAM_BOT_TOKEN / channel / лимиты API.
