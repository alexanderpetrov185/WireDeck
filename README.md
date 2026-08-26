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

**Optional premium/аналитика** (часто 403/empty или paywall) — включать по необходимости: WSJ, FT, Bloomberg, Seeking Alpha.