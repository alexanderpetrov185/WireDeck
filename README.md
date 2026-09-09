# WireDeck Monorepo

## О проекте

**WireDeck** — AI-управляемая система обработки финансовых новостей.

**Telegram** является центральной платформой доставки контента.

Финальный бизнес-пайплайн (фактический, реализован):

```
Sources (RSS)
→ Collectors
→ Ingestion + Deduplication      (status: raw)
→ AI Processing                  (raw → processed)
→ Translation                    (processed → queued; translatedText пишется сразу)
→ Moderation                     (queued → approved / rejected)
→ Publishing                     (approved → published)
→ Telegram channel
```

Ключевые решения:
- **Telegram-centric**: Telegram — единственный канал публикации.
- **EN default**: `TRANSLATION_TARGET_LANGUAGE=en`; модель `sourceLanguage → translatedText`.
- Основной status flow: `raw → processed → queued → approved → published`
  (статус `translated` существует в enum, но в pipeline после перевода ставится `queued`).
- Content Enrichment **не реализован и не входит в текущий roadmap**.

## Структура
- `apps/backend`: NestJS/Node.js API (+BullMQ pipeline, Prometheus `/metrics`, Sentry)
- `apps/frontend`: Next.js Admin Panel (App Router, BFF через Route Handlers `/api/admin/*`)
- `infra/docker`: Конфиги для локального деплоя + monitoring stack

## Запуск

### Локальная разработка (без Docker)
```bash
cp .env.example .env   # заполнить DB_PASSWORD, INGESTION_TOKEN и ключи провайдеров
npm install
npm run dev
```
- Backend: http://localhost:3000
- Frontend: http://localhost:3001

### Docker (полный стек)
```bash
cp .env.example .env   # обязательно заполнить DB_* и секреты
npm install
docker compose up -d
```
Поднимает PostgreSQL, Redis, Backend (3000), Frontend (3001).

**Production/VPS:** см. `docs/DEPLOY.md` — reverse-proxy + TLS (Caddy),
ports policy, secrets checklist, Postgres backup/restore, update flow.

### Docker Compose (отдельные команды)
```bash
npm run docker:up       # docker compose -f compose.yaml up -d
npm run docker:down     # docker compose -f compose.yaml down
npm run docker:build    # docker compose -f compose.yaml build
```

## Контентные источники (RSS)

Входной поток новостей задаётся только через env `RSS_FEEDS` (стандартные URL RSS 2.0/Atom, через запятую). Код не содержит хардкод-списков.

**Pragmatic default pack** (business / markets, EN) — в `.env.example`:
- Reuters Agency — Business
- CNBC — Top News
- CNBC — Markets
- MarketWatch — Top Stories
- Yahoo Finance — News
- Investing.com — Economy News
- CoinDesk — Crypto News
- BBC — Business

**Как добавить свои фиды:**
```bash
RSS_FEEDS="https://example.com/feed.xml, https://other.com/rss"
```
- Коллектор отбрасывает невалидные (`не http(s)`) и дубликаты URL с warn-логом; один упавший фид не прерывает сбор остальных.
- Если URL содержит `&` — оборачивайте значение `RSS_FEEDS` в кавычки (в shell/compose).
- Дедупликация новостей между фидами выполняется уже на уровне ingestion (по `hash`), поэтому пересечения в разных фидах не порождают дублей.

## Режим ежедневной работы (runbook)

Спринт 18: операционные дефолты для автономной работы без ручного trigger.

### 1. Как включить scheduler

По умолчанию `SCHEDULER_ENABLED=false` (безопасно — pipeline не стартует сам). Чтобы включить ежедневные автоматические запуски:

```bash
# в .env раскомментируйте recommended daily-operation block
SCHEDULER_ENABLED=true
PIPELINE_INTERVAL_MS=3600000   # 1 час
PIPELINE_BATCH_LIMIT=10
MODERATION_MODE=hybrid
MODERATION_AUTO_IMPORTANCE_MIN=0.6

docker compose up -d            # пересоздаст backend с новым env
```

Проверить, что scheduler реально включён:
```bash
docker compose logs -f backend | grep Scheduler
# → "Scheduler enabled, interval: 3600000ms"
# → "Pipeline job enqueued" (на каждом тике)
```

### 2. Что делает каждый тик

Полный pipeline: `RSS collection → Ingestion+dedup → AI processing → Translation → Moderation (по MODERATION_MODE) → Publishing → Telegram`.

### 3. Дедупликация jobId (нет параллельных прогонов)

Каждый тик посылает BullMQ job с фиксированным `jobId`. Если предыдущий прогон ещё выполняется (active/waiting/delayed) — новый тик пропускается:
```
→ "Pipeline job already active. Skipping duplicate enqueue."
```
Параллельные прогоны и двойные публикации исключены. Ручной «Run Pipeline» из админки использует тот же jobId и тоже дедуплицируется.

### 4. Режимы модерации и риск «тишины»

| MODERATION_MODE | Поведение публикации | Риск |
|---|---|---|
| `auto` | всё QUEUED публикуется само | канал полон, могут быть маловажные посты |
| `hybrid` (реком.) | важные (`importance≥0.6`) сами, остальное — на ручную модерацию | непросмотренная очередь = пропущенные посты |
| `manual` | ничего не публикуется без оператора | **если оператор не заходит — канал молчит** |

> **Market impact (Sprint 22a):** WireDeck — инструмент рыночных сигналов, а не зеркало новостей.
> Каждая новость оценивается AI по рыночной значимости (`impactScore` 0..1). Автопубликация (auto/hybrid)
> требует прохождения порога `IMPACT_PUBLISH_MIN` (см. `.env.example`); низко-impact новости остаются
> в очереди модерации. Поля `unconfirmed`/insider-источники всегда маркируются в посте «⚠️ НЕ ПОДТВЕРЖДЕНО».
> WireDeck не даёт инвестиционных рекомендаций.

### Source tiers (Sprint 22b)

Каждому источнику при ingestion присваивается tier (1/2/3) из операторского конфига
`source.tiers.json` (по образцу compliance-списков):

1. `cp source.tiers.example.json source.tiers.json` и отредактируйте:
   ```json
   { "bySourceName": { "CNBC": 1, "Reuters": 1 }, "default": 2 }
   ```
2. `docker compose up -d` (файл читается при старте).
3. Проверка: `docker compose logs backend | grep "Source tiers"`.

Правила матчинга: ключ сравнивается с `feed.title` case-insensitive, сначала точно,
затем как substring — короткий ключ `CNBC` матчит `CNBC: Top News & Analysis`.
Tier 1 получает смягчённый порог автопубликации (`IMPACT_TIER1_MIN`, Sprint 22a).
Критерии: **tier 1** — первоисточники макро/рынков (Reuters, CNBC, MarketWatch, WSJ);
**tier 2** — полезный фон (Yahoo Finance, Investing.com, BBC Business, CoinDesk);
**tier 3** — lifestyle/human-interest/спорт/мнения без цифр (в default не подключаются).
Twitter watchlist (для Sprint 22c) — заготовка `twitter.watchlist.example.json`, код чтения пока отсутствует.

В `manual`/`hybrid` неопубликованное висит в `/moderation` (badge в шапке). Если канал «молчит», проверьте в порядке: `SCHEDULER_ENABLED`, `MODERATION_MODE`, и не пустая ли очередь модерации.

### 5. Операционка

- **Логи:** `docker compose logs -f backend` (RssCollector / IngestionService / ModerationService / PublishingService — каждый пишет свой контекст и итоги прогона).
- **Ручной trigger:** админка → Dashboard → **Run Pipeline** (или `curl -X POST -H 'x-ingestion-token: …' localhost:3000/pipeline/trigger`).
- **Publish from admin:** `/moderation` → Approve (или напрямую `/news?status=approved` → **Publish**); на Dashboard есть кнопка **Publish pending** для всей очереди APPROVED.
**Optional premium/аналитика** (часто 403/empty или paywall) — включать по необходимости: WSJ, FT, Bloomberg, Seeking Alpha.