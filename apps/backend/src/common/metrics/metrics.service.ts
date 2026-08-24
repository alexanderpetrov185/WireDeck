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
  queueJobCounts,
  queueJobsStalledTotal,
  publishingStuckNews,
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

  /**
   * Реальные счётчики BullMQ по состояниям (Sprint 11).
   * @param counts Результат queue.getJobCounts() (waiting/active/...)
   */
  setQueueJobCounts(queueName: string, counts: Record<string, number>) {
    for (const [state, value] of Object.entries(counts)) {
      if (typeof value === 'number') {
        queueJobCounts.set({ queue_name: queueName, state }, value);
      }
    }
  }

  // Инкремент счётчика stalled job'ов (Sprint 11)
  incQueueStalled(queueName: string) {
    queueJobsStalledTotal.inc({ queue_name: queueName });
  }

  // Gauge застрявших публикаций (Sprint 8.5 detection). ID — только в логах.
  setPublishingStuck(count: number) {
    publishingStuckNews.set(count);
  }


  // Получение количества метрик (для отладки)
  getMetricsCount(): number {
    return Object.keys((register as any).collectors).length;
  }
}
