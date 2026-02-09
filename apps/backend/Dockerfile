FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

RUN npm ci --legacy-peer-deps

COPY apps/backend/ ./apps/backend/
COPY tsconfig.json ./

RUN npm run build --workspace=@crypto-news-bot/backend

FROM node:22-alpine AS production

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/backend/package*.json ./apps/backend/

EXPOSE 3000

CMD ["npm", "run", "start:prod", "--workspace=@crypto-news-bot/backend"]