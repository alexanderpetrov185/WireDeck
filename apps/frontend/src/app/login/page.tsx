'use client';

import { useState } from 'react';

/**
 * Страница логина админки.
 *
 * Специально БЕЗ useSearchParams/Suspense/useRouter:
 * - useSearchParams вызывает static-prerender bailout, и браузер получает
 *   только Suspense-fallback ("Loading…") до гидрации; при сбое JS-чанков
 *   пользователь навсегда видит лоадер вместо формы.
 * - Эта страница полностью статична в SSR-HTML: форма рендерится сразу,
 *   без ожидания admin API и без data-loading shell.
 * - `next` читается из window.location в момент сабмота;
 *   после успеха — hard navigation, чтобы middleware гарантированно
 *   увидел свежую cookie.
 */
export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resolveNext(): string {
    if (typeof window === 'undefined') {
      return '/';
    }
    const next = new URLSearchParams(window.location.search).get('next');
    // Разрешаем только внутренние пути (защита от open redirect).
    return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  }

  async function handleSubmit(e: React.FormEvent) {
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
    <div className="flex min-h-[60vh] items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
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
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
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
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}