# Backend Dockerfile для монорепозитория
# Сборка NestJS приложения с поддержкой workspace

FROM node:22-alpine AS builder

# Установка рабочей директории
WORKDIR /app

# Копируем корневые файлы зависимостей для кэширования npm
COPY package.json package-lock.json* ./
COPY apps/backend/package.json ./apps/backend/

# Копируем tsconfig.json для компиляции TypeScript
COPY apps/backend/tsconfig.json ./apps/backend/

# Установка зависимостей с флагом --legacy-peer-deps для обхода конфликтов
RUN npm ci --legacy-peer-deps

# Копируем исходный код backend
COPY apps/backend/src ./apps/backend/src

# Сборка backend приложения
RUN npm run build --workspace=@wiredeck/backend

# Production стадия
FROM node:22-alpine AS production

WORKDIR /app

# Копируем только необходимые файлы для запуска
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/package.json ./

# Sprint 19: копируем example в стандартный путь для default-активации.
# Оператор переопределяет реальными списками через volume-mount в compose.
COPY compliance.lists.example.json ./compliance.lists.json
# Sprint 22b: source tiers — аналогично, example как default.
COPY source.tiers.example.json ./source.tiers.json
# Sprint 22c: twitter watchlist example (collector выключен без TWITTER_API_KEY).
COPY twitter.watchlist.example.json ./twitter.watchlist.json

# Создаем директорию для логов
RUN mkdir -p /app/logs

# Порт приложения
EXPOSE 3000

# Запуск приложения
CMD ["node", "apps/backend/dist/main.js"]
