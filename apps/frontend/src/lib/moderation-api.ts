// API-функции для модерации через BFF.
import { fetchJson } from './api-client';
import { ModerationResult } from './types';

/**
 * Одобрение новости.
 * moderator передаётся на сервер (BFF) — клиент не знает ADMIN_MODERATOR.
 */
export async function approveNews(id: string): Promise<ModerationResult> {
  return fetchJson<ModerationResult>(`/api/admin/moderation/approve/${encodeURIComponent(id)}`, {
    method: 'POST',
  });
}

/**
 * Отклонение новости с обязательной причиной.
 * reason передаётся в body (JSON) — BFF безопасно URL-encode при вызове backend.
 */
export async function rejectNews(id: string, reason: string): Promise<ModerationResult> {
  return fetchJson<ModerationResult>(`/api/admin/moderation/reject/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}