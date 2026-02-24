# MarketTwits_Uz Monorepo

## Структура
- `apps/backend`: NestJS/Node.js API
- `apps/frontend`: Next.js Web App
- `packages/shared`: Типы и общие утилиты
- `infra/docker`: Конфиги для локального деплоя

## Запуск
1. `npm install`
2. `docker-compose -f infra/docker/docker-compose.yml up`