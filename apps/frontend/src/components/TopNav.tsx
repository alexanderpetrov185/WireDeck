// TopNav — Server Component (fix logout без гидрации):
// Logout — нативная HTML-форма, работает даже без клиентского JS.
// На /login не рендерится (нет session cookie).
// active подсвечивает текущий раздел; badge показывает очередь модерации
// (fail-safe: если stats недоступен — badge просто не показывается).
import Link from 'next/link';
import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE } from '@/lib/server/admin-auth';
import { fetchFromBackend } from '@/lib/server/backend-client';
import { NewsStats } from '../lib/types';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', key: 'dashboard' },
  { href: '/news', label: 'News', key: 'news' },
  { href: '/moderation', label: 'Moderation', key: 'moderation' },
];

export default async function TopNav({ active }: { active?: string }) {
  const store = await cookies();
  // На странице логина (нет валидной сессии) навигация не нужна.
  const hasSession = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!hasSession) {
    return null;
  }

  // Queued badge: fail-safe — при сбое stats просто не рисуем.
  let queuedCount: number | null = null;
  try {
    const stats = await fetchFromBackend<NewsStats>('/news/stats');
    queuedCount = stats.queued;
  } catch {
    queuedCount = null;
  }

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-8 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">WireDeck Admin</h1>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = item.key === active;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                    {item.key === 'moderation' && queuedCount !== null && queuedCount > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                        {queuedCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
          {/* Нативная форма logout: работает даже без клиентского JS. */}
          <form method="post" action="/api/admin/auth/logout">
            <button
              type="submit"
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300"
            >
              Logout
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}