// TopNav — Server Component (fix logout без гидрации):
// Logout — нативная HTML-форма, работает даже без клиентского JS.
// На /login не рендерится (нет session cookie).
import Link from 'next/link';
import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE } from '@/lib/server/admin-auth';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/news', label: 'News' },
  { href: '/moderation', label: 'Moderation' },
];

export default async function TopNav() {
  const store = await cookies();
  // На странице логина (нет валидной сессии) навигация не нужна.
  const hasSession = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!hasSession) {
    return null;
  }

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold text-gray-900">WireDeck Admin</h1>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  {item.label}
                </Link>
              ))}
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