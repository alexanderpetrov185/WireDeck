# Frontend Dockerfile для монорепозитория
# Сборка Next.js приложения с поддержкой workspace

FROM node:22-alpine AS builder

# Установка рабочей директории
WORKDIR /app

# Копируем корневые файлы зависимостей для кэширования npm
COPY package.json package-lock.json* ./
COPY apps/frontend/package.json ./apps/frontend/

# Копируем конфиги Next.js и TypeScript
COPY apps/frontend/next.config.js ./apps/frontend/
COPY apps/frontend/tsconfig.json ./apps/frontend/
COPY apps/frontend/next-env.d.ts ./apps/frontend/

# Установка зависимостей с флагом --legacy-peer-deps для обхода конфликтов
RUN npm ci --legacy-peer-deps

# Копируем исходный код frontend
COPY apps/frontend/src ./apps/frontend/src

# Сборка frontend приложения
RUN npm run build --workspace=@wiredeck/frontend

# Production стадия
FROM node:22-alpine AS production

WORKDIR /app

# Копируем только необходимые файлы для запуска
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=builder /app/apps/frontend/package.json ./apps/frontend/
COPY --from=builder /app/package.json ./

# Порт приложения
EXPOSE 3001

# Запуск приложения в production режиме
# В monorepo standalone-сборка Next.js создает server.js по пути:
# .next/standalone/apps/frontend/server.js
CMD ["node", "apps/frontend/.next/standalone/apps/frontend/server.js"]
