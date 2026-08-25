'use client';

import { useEffect, useState } from 'react';

/**
 * Страница логина админки.
 *
 * Защита от утечки пароля в URL:
 * - Основной путь: onSubmit -> preventDefault -> fetch POST JSON.
 * - Fallback без JS: форма нативно постит method="post" action="/api/admin/..."
 *   (никогда не GET), route handler принимает urlencoded body.
 * - Если в URL уже есть ?password=... (след старого бага) — вычищаем
 *   адресную строку через history.replaceState и игнорируем параметр.
 *
 * Без useSearchParams/Suspense: форма полностью статична в SSR-HTML,
 * не зависит от гидрации, чтобы никогда не показывать вечный Loading.
 */
export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Чистим адресную строку от следов старого GET-сабмита (?password=...).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  function resolveNext(): string {
    if (typeof window === 'undefined') {
      return '/';
    }
    const next = new URLSearchParams(window.location.search).get('next');
    // Разрешаем только внутренние пути (защита от open redirect).
    return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.assign(resolveNext());
        return;
      }
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(
        res.status === 401
          ? 'Invalid password.'
          : body?.message ?? `Login failed (HTTP ${res.status}).`,
      );
    } catch {
      setError('Network error: unable to reach login API.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white shadow-md rounded-lg px-8 py-8">
          <h1 className="text-xl font-bold text-gray-900 text-center mb-1">WireDeck Admin</h1>
          <p className="text-sm text-gray-500 text-center mb-6">Sign in to continue</p>
          <form
            onSubmit={handleSubmit}
            method="post"
            action="/api/admin/auth/login"
            className="space-y-4"
          >
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Admin password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                autoComplete="current-password"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 focus:outline-none disabled:opacity-50"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}