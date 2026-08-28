# WireDeck — VPS Deployment Guide (Sprint 20)

Цель: безопасно развернуть production-стек на VPS с reverse-proxy + TLS.
Минимум ручного вмешательства, совместимо с локальным dev-режимом.

> Данный документ описывает **рекомендуемую** production-конфигурацию.
> Локальный dev-режим (`docker compose up` без `BIND_IP`) не меняется и
> остаётся прежним: все порты слушают все интерфейсы.

---

## 1. Production topology

```
        Internet
            │  :80 / :443  (TLS)
            ▼
      Caddy (host or container)
            │  reverse-proxy (X-Forwarded-Proto set by Caddy)
            ▼
        frontend :3001
            │  server-side BFF (BACKEND_API_URL=http://backend:3000)
            ▼
        backend  :3000 ── docker network only ──►  postgres:5432
        backend  :3000 ── docker network only ──►  redis:6379
```

- **frontend** — единственная точка входа извне (через Caddy).
- **backend** — НЕ публикуется наружу (или `BIND_IP=127.0.0.1`). Обращается к нему
  только frontend BFF внутри сети compose.
- **postgres / redis** — только внутри docker-сети, порты наружу не выводятся
  (это уже так в `compose.yaml` — security hardening).

## 2. Ports policy

Рекомендуемая политика для VPS (`BIND_IP=127.0.0.1` или закрытые firewall):

| Сервис | Внутр. порт | Публикация | Комментарий |
|--------|-----------|------------|-------------|
| postgres | 5432 | **нет** | только docker-сеть |
| redis | 6379 | **нет** | только docker-сеть |
| backend | 3000 | **нет** (или 127.0.0.1:3000) | только frontend BFF |
| frontend | 3001 | 127.0.0.1:3001 | только через Caddy |
| caddy | 80/443 | 0.0.0.0:80/443 | TLS-termination |
| prometheus | 9090 | 127.0.0.1 | см. § Monitoring warnings |

Firewall (UFW): открыть только `22/80/443`, остальное закрыто из WAN.
Доступ к admin-UI, пром. портам — только через TLS-frontend или SSH-tunnel.

## 3. Caddy + TLS

Caddy — рекомендованный reverse proxy с автоматическими Let's Encrypt-сертификатами.

**Вариант A (рекоменд.): Caddy контейнером в той же сети compose.**

```yaml
# docker-compose.caddy.yml (отдельный файл, НЕ часть базового compose)
services:
  caddy:
    image: caddy:2-alpine
    container_name: wiredeck-caddy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - wiredeck_default   # та же сеть, что у frontend

volumes:
  caddy_data:
  caddy_config:
```

**Вариант B (просто): Caddy на хосте** — reverse-proxy на `127.0.0.1:3001`.

### Caddyfile (оба варианта)

См. `infra/docker/Caddyfile`. Ядро:

```caddy
wiredeck.example.com {
    reverse_proxy frontend:3001
}
```

Caddy сам ставит `X-Forwarded-Proto: https` → Next.js admin cookie получит
`Secure`-флаг (логика в `apps/frontend/src/app/api/admin/auth/login/route.ts`).
Проверьте после деплоя авторизацию по HTTPS (см. § Production checklist).

## 4. Secrets checklist

`.env` в корне репозитория, **никогда не коммитится** (в `.gitignore`),
режим `chmod 600 .env`.

Обязательные (без них compose не поднимет / админка закрыта):
- `DB_PASSWORD` — сильный, уникальный.
- `ADMIN_PASSWORD` — пароль админ-BFF. Рекомендация: ≥ 16 симв., сгенерировать
  (`openssl rand -base64 18`). Пустой → весь `/api/admin/*` закрыт (401).
- `INGESTION_TOKEN` — заголовок `x-ingestion-token`; сильный, НЕ совпадает с ADMIN_PASSWORD.
- `AI_API_KEY`, `TRANSLATION_API_KEY` — ключи провайдеров.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`.

Опционально:
- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`.
- `MODERATION_MODE` (`auto`/`manual`/`hybrid`), `SCHEDULER_ENABLED`, `PIPELINE_INTERVAL_MS`,
  `COMPLIANCE_LISTS_PATH`, `LOG_LEVEL`.

Права:
```bash
chmod 600 .env
```

Ротация: при подозрении утечки — сменить `ADMIN_PASSWORD`, `INGESTION_TOKEN`,
## 5. Postgres backup / restore

> БД монтируется в том `postgres_data`. Все изменения хранятся там —
> резервные копии **обязательны**.

### Backup (custom-format)
```bash
docker exec wiredeck-postgres pg_dump -U postgres -Fc wiredeck > wiredeck-$(date +%Y%m%d-%H%M).dump
```
Пример cron (ежедневно 02:30, хранение 14 дней):
```bash
30 2 * * * cd /srv/wiredeck && docker exec wiredeck-postgres pg_dump -U postgres -Fc wiredeck > backups/wiredeck-$(date +\%Y\%m\%d).dump && find backups -name '*.dump' -mtime +14 -delete
```

### Restore
```bash
# остановить backend (чтобы не писать в БД во время восстановления)
docker compose stop backend
# восстановить (создаст/перезапишет объекты схемы)
docker exec -i wiredeck-postgres pg_restore -U postgres -d wiredeck --clean --if-exists < wiredeck-YYYYmmdd.dump
# поднять обратно (backend сам применит миграции — migrationsRun: true)
docker compose up -d
```

### Проверка бэкапа
Периодически восстанавливайте в побочную БД (--target-db) и сверяйте счётчики:
`SELECT count(*) FROM news;`.

## 6. Update flow

```bash
cd /srv/wiredeck
git pull --ff-only            # установить последние изменения
docker compose up -d --build  # пересобрать образы + пересоздать контейнеры
# smoke (см. Production checklist п.9)
```

Откат: `git checkout <prev>` + `docker compose up -d --build`.

## 7. Production checklist

1. **DNS**: A-запись `wiredeck.example.com → <VPS IP>`; проверьте `dig`.
2. **Firewall (UFW)**: открыто `22/80/443`; остальное закрыто из WAN.
3. **`.env`**: все обязательные секреты (см. § Secrets checklist), `chmod 600 .env`.
4. **Compliance**: `cp compliance.lists.example.json compliance.lists.json` и
   отредактировать реальные списки (Sprint 19). Файл в `.gitignore` — реальные данные не коммитятся.
5. **Caddy**: настроить `Caddyfile`, проверить сертификат: `curl -I https://wire.example.com`.
6. **Config sanity**: `docker compose config` (нет ошибок, все required env заданы).
7. **Backend не публикуем**: remove `ports`/`BIND_IP=127.0.0.1`, либо firewall.
8. **Запуск**: `docker compose up -d --build`.
9. **Smoke**:
   - `curl https://wire.example.com/health` → `database:up`, `redis:up`
   - `curl https://wire.example.com/health/live` → `{"status":"ok"}`
   - admin: вход по HTTPS → dashboard, pipeline trigger, approve→publish.
10. **Бэкапы**: первичный `pg_dump`, настроить cron.
11. **Мониторинг наружу не публиковать** (см. § 8).

## 8. Monitoring warnings

Стек `infra/docker/docker-compose.monitoring.yml` по умолчанию:
- Grafana `admin/admin123` (`GF_SECURITY_ADMIN_PASSWORD`) — **обязательно сменить**.
- Сервисы публикуют порты (`9090/3002/3100/9100`) на все интерфейсы —
  в production не публиковать наружу: `BIND_IP=127.0.0.1` или firewall.
- Loki/Promtail пишут в `./logs` хоста — обеспечьте ротацию.

В Sprint 20 **не пересобирается** (локальный dev не меняется) — оператор
подстраивает перед реальным боевым запуском.

## 9. Troubleshooting

| Симптом | Действие |
|---------|----------|
| admin cookie не ставится / не авторизует | проверить `X-Forwarded-Proto: https` от Caddy; тест логина по HTTPS |
| frontend не видит backend | `docker compose logs frontend`; `BACKEND_API_URL=http://backend:3000` |
| миграции не применились | `docker compose logs backend`; `migrationsRun: true` на старте |
| нет compliance | см. `docs/compliance.md`; лог `Compliance labeling enabled` |
| битый бэкап | использовать `-Fc`; восстанавливать на тест-БД |
ключи провайдеров; пересоздать контейнеры `docker compose up -d --force-recreate`.