// API-функции для pipeline через BFF.
import { fetchJson } from './api-client';
import { PipelineTriggerResult } from './types';

/**
 * Ручной запуск pipeline.
 * Возвращает { enqueued: boolean } — создан ли job.
 */
export async function triggerPipeline(): Promise<PipelineTriggerResult> {
  return fetchJson<PipelineTriggerResult>('/api/admin/pipeline/trigger', {
    method: 'POST',
  });
}