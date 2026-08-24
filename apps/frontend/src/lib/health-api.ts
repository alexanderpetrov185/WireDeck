// API-функции для проверки состояния backend через BFF.
import { fetchJson } from './api-client';
import { HealthStatus } from './types';

/**
 * Получение статуса backend (/health через BFF).
 */
export async function getHealth(): Promise<HealthStatus> {
  return fetchJson<HealthStatus>('/api/admin/health');
}