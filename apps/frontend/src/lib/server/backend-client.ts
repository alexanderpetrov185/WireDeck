// Server-only helper для BFF Route Handlers.
// Вызывает backend с x-ingestion-token. НИКОГДА не экспортируется в client bundle.

import { NextRequest, NextResponse } from 'next/server';

/**
 * Возвращает backend base URL для server-side вызовов.
 * В Docker-сети frontend обращается к backend по имени сервиса.
 * Локально (dev) — localhost.
 */
export function getBackendBaseUrl(): string {
  return process.env.BACKEND_API_URL || 'http://localhost:3000';
}

/**
 * Выполняет server-side запрос к backend с токеном.
 * Возвращает NextResponse с проксированным статусом и безопасным JSON body.
 */
export async function proxyBackend(
  path: string,
  init?: RequestInit,
): Promise<NextResponse> {
  const token = process.env.INGESTION_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: 'admin_configuration_error', message: 'Admin token is not configured on the server.' },
      { status: 500 },
    );
  }

  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-ingestion-token': token,
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { error: 'backend_unavailable', message: 'Backend is unavailable.' },
      { status: 502 },
    );
  }

  // Проксируем статус, но не возвращаем backend stack traces.
  const status = response.status;
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (status >= 500) {
    return NextResponse.json(
      { error: 'backend_error', message: 'Backend returned an error.' },
      { status },
    );
  }

  return NextResponse.json(body, { status });
}

/**
 * Server-side fetch данных из backend для Server Components.
 * Бросает ошибку при неуспехе — страницы показывают ErrorState вместо вечного Loading.
 */
export async function fetchFromBackend<T>(path: string): Promise<T> {
  const token = process.env.INGESTION_TOKEN;
  if (!token) {
    throw new Error('INGESTION_TOKEN is not configured on the server.');
  }
  const response = await fetch(`${getBackendBaseUrl()}${path}`, {
    headers: { 'x-ingestion-token': token },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Backend returned HTTP ${response.status} for ${path}`);
  }
  return (await response.json()) as T;
}

/**
 * true, если запрос пришёл от нативной HTML-формы (fallback без JS).
 */
export function isFormPost(req: NextRequest): boolean {
  return (req.headers.get('content-type') ?? '').includes(
    'application/x-www-form-urlencoded',
  );
}

/**
 * 303 redirect с относительным Location (браузер резолвит против текущего хоста;
 * абсолютный URL собрался бы с hostname контейнера и был бы недоступен снаружи).
 */
export function seeOther(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

/**
 * Как proxyBackend, но возвращает статус и разобранное тело —
 * нужно, когда результат выражен в body ({processed,skipped,errors}),
 * а не в HTTP-статусе (например publishing endpoints всегда 200).
 */
export async function proxyBackendParsed(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const token = process.env.INGESTION_TOKEN;
  if (!token) {
    return { status: 500, body: { error: 'admin_configuration_error' } };
  }
  try {
    const response = await fetch(`${getBackendBaseUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-ingestion-token': token,
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body: body as Record<string, unknown> | null };
  } catch {
    return { status: 502, body: { error: 'backend_unavailable' } };
  }
}

/**
 * Добавляет query-параметр к внутреннему пути (для redirect-баннеров).
 */
export function withQueryParam(path: string, key: string, value: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}${key}=${encodeURIComponent(value)}`;
}

/**
 * Safe next path: только внутренние пути, начинающиеся с '/',
 * без protocol-relative ('//') — защита от open redirect.
 */
export function safeNext(raw: FormDataEntryValue | null | undefined, fallback = '/'): string {
  return typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : fallback;
}