// Клиентская обёртка для BFF API.
// Обращается ТОЛЬКО к /api/admin/* (Next.js Route Handlers).
// НЕ знает о INGESTION_TOKEN — токен живёт только на сервере.

import { ApiError } from './types';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Выполняет fetch к BFF и возвращает JSON.
 * Бросает ApiClientError при non-2xx или malformed response.
 */
export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
  } catch {
    throw new ApiClientError('Network error: unable to reach admin API', 0, 'network_error');
  }

  if (!response.ok) {
    // Сессия истекла / отсутствует — отправляем на страницу логина.
    if (response.status === 401 && typeof window !== 'undefined') {
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `/login?next=${next}`;
      throw new ApiClientError('Authentication required', 401, 'unauthorized');
    }
    let body: ApiError | null = null;
    try {
      body = (await response.json()) as ApiError;
    } catch {
      // non-JSON error body — оставляем null
    }
    throw new ApiClientError(
      body?.message ?? body?.error ?? `Request failed with status ${response.status}`,
      response.status,
      body?.error,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiClientError('Malformed response from admin API', response.status, 'malformed_response');
  }
}