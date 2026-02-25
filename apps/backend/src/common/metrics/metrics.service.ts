// Сервис метрик для NestJS
// Предоставляет методы для работы с Prometheus метриками

import { Injectable } from '@nestjs/common';
import {
  register,
  httpRequestsTotal,
  httpRequestDuration,
  databaseQueryDuration,
  databaseErrorsTotal,
  queueJobsTotal,
  queueJobDuration,
  queueSize,
  getMetrics,
} from './metrics.config';

@Injectable()
export class MetricsService {
  // Получение всех метрик в формате Prometheus
  async getMetrics(): Promise<string> {
    return getMetrics();
  }

  // Наблюдение за HTTP запросами
  observeHttpRequest(method: string, path: string, statusCode: number, duration: number) {
    httpRequestsTotal.inc({ method, path, status_code: statusCode });
    httpRequestDuration.observe({ method, path }, duration);
  }

  // Наблюдение за запросами к БД
  observeDatabaseQuery(queryType: string, duration: number) {
    databaseQueryDuration.observe({ query_type: queryType }, duration);
  }

  // Логирование ошибок БД
  logDatabaseError(errorType: string) {
    databaseErrorsTotal.inc({ error_type: errorType });
  }

  // Наблюдение за задачами очереди
  observeQueueJob(queueName: string, jobName: string, status: 'completed' | 'failed', duration: number) {
    queueJobsTotal.inc({ queue_name: queueName, job_name: jobName, status });
    queueJobDuration.observe({ queue_name: queueName, job_name: jobName }, duration);
  }

  // Обновление размера очереди
  updateQueueSize(queueName: string, size: number) {
    queueSize.set({ queue_name: queueName }, size);
  }

  // Получение количества метрик (для отладки)
  getMetricsCount(): number {
    return register.size;
  }
}
