# WireDeck Monorepo

## Структура
- `apps/backend`: NestJS/Node.js API
- `apps/frontend`: Next.js Web App
- `packages/shared`: Типы и общие утилиты
- `infra/docker`: Конфиги для локального деплоя

## Запуск

### Локальная разработка (без Docker)
```bash
npm install
npm run dev
```
- Backend: http://localhost:3000
- Frontend: http://localhost:3001

### Docker (полный стек)
```bash
npm install
docker compose up
```
Поднимает PostgreSQL, Redis, Backend (3000), Frontend (3001).

### Docker Compose (отдельные команды)
```bash
npm run docker:up       # docker compose -f compose.yaml up -d
npm run docker:down     # docker compose -f compose.yaml down
npm run docker:build    # docker compose -f compose.yaml build
```
