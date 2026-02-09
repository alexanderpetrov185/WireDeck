FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/

RUN npm ci --legacy-peer-deps

COPY apps/frontend/ ./apps/frontend/
COPY tsconfig.json ./

RUN npm run build --workspace=@crypto-news-bot/frontend

FROM node:22-alpine AS production

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY --from=builder /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/frontend/package*.json ./apps/frontend/

EXPOSE 3001

CMD ["npm", "run", "start", "--workspace=@crypto-news-bot/frontend"]