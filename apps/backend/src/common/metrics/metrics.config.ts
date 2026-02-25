// Конфигурация Prometheus метрик
// Создает стандартные и кастомные метрики для приложения

import * as promClient from 'prom-client';

// Регистр метрик
export const register = new promClient.Registry();

// Добавление стандартных метрик Node.js
promClient.collectDefaultMetrics({ register });

// Кастомные метрики

// 1. Счетчик HTTP запросов
export const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code'],
  registers: [register],
});

// 2. Гистограмма времени ответа HTTP
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5], // Секунды
  registers: [register],
});

// 3. Гистограмма времени выполнения запросов к БД
export const databaseQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// 4. Счетчик ошибок базы данных
export const databaseErrorsTotal = new promClient.Counter({
  name: 'database_errors_total',
  help: 'Total number of database errors',
  labelNames: ['error_type'],
  registers: [register],
});

// 5. Гистограмма времени обработки задач в очереди
export const queueJobDuration = new promClient.Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Duration of queue job processing in seconds',
  labelNames: ['queue_name', 'job_name'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
  registers: [register],
});

// 6. Счетчик обработанных задач
export const queueJobsTotal = new promClient.Counter({
  name: 'queue_jobs_total',
  help: 'Total number of processed queue jobs',
  labelNames: ['queue_name', 'job_name', 'status'],
  registers: [register],
});

// 7. Гauge для размера очереди
export const queueSize = new promClient.Gauge({
  name: 'queue_size',
  help: 'Current size of the queue',
  labelNames: ['queue_name'],
  registers: [register],
});

// 8. Информация о приложении
export const appInfo = new promClient.Gauge({
  name: 'app_info',
  help: 'Application information',
  labelNames: ['version', 'node_version', 'env'],
  registers: [register],
});

// Установка информации о приложении
appInfo.set(
  {
    version: process.env.npm_package_version || '1.0.0',
    node_version: process.version,
    env: process.env.NODE_ENV || 'development',
  },
  1,
);

// Функция для получения метрик
export async function getMetrics(): Promise<string> {
  return await register.metrics();
}

// Функция для сброса метрик (для тестов)
export function resetMetrics() {
  register.clear();
}
