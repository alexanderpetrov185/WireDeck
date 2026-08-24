// Server-only helper для BFF Route Handlers.
// Вызывает backend с x-ingestion-token. НИКОГДА не экспортируется в client bundle.

import { NextResponse } from 'next/server';

/**
 * Возвращает backend base URL для server-side вызовов.
 * В Docker-сети frontend обращается к backend по имени сервиса.
 * Локально (dev) — localhost.
 */
export function getBackendBaseUrl(): string {
  return process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
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