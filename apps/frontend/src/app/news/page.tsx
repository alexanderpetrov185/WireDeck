// News list — Server Component (fix admin loading):
// данные рендерятся на сервере; фильтр статуса — обычная GET-форма без JS.
import Link from 'next/link';
import { fetchFromBackend } from '@/lib/server/backend-client';
import StatusBadge from '@/components/StatusBadge';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import TopNav from '@/components/TopNav';
import { NewsItem, NewsStatus, NewsStats } from '@/lib/types';
import { formatDate, formatImportance, sourceLabel } from '@/lib/news-labels';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;
const STATUSES: NewsStatus[] = ['raw', 'processed', 'translated', 'queued', 'approved', 'published', 'rejected'];

/** Кликабельный чип фильтра статуса с count (если известен). */
function Chip({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
      {typeof count === 'number' && (
        <span
          className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs ${
            active ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

/** Человекочитаемый текст banner-параметров publish-действий. */
function publishBanner(params: Record<string, string | string[] | undefined>): { kind: 'ok' | 'err'; text: string } | null {
  if (params.published === '1') {
    return { kind: 'ok', text: 'Published to Telegram.' };
  }
  if (params.already_published === '1') {
    return { kind: 'ok', text: 'Already published earlier — skipped (no duplicate sent).' };
  }
  if (params.publish_error === '1') {
    return { kind: 'err', text: 'Publish failed. News must be APPROVED and Telegram must be reachable.' };
  }
  return null;
}

export default async function NewsListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const statusRaw = typeof params.status === 'string' ? params.status : '';
  const statusFilter = STATUSES.includes(statusRaw as NewsStatus) ? (statusRaw as NewsStatus) : '';

  const banner = publishBanner(params);

  let news: NewsItem[];
  // Counts для чипов: fail-safe — без stats чипы остаются простыми ссылками.
  let counts: NewsStats | null = null;
  try {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), skip: '0' });
    if (statusFilter) qs.set('status', statusFilter);
    news = await fetchFromBackend<NewsItem[]>(`/news?${qs.toString()}`);
    counts = await fetchFromBackend<NewsStats>('/news/stats').catch(() => null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load news';
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">News</h2>
        <ErrorState message={msg} />
      </div>
    );
  }

  return (
    <div>
      <TopNav active="news" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">News</h2>
      </div>

      {banner && (
        <div
          role="status"
          className={`mb-4 rounded-md p-4 text-sm ${
            banner.kind === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* Status chips с counts (Sprint 16). Counts fail-safe: без stats — просто ссылки. */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Chip href="/news" active={statusFilter === ''} label="All" count={counts?.total} />
        {STATUSES.map((s) => (
          <Chip
            key={s}
            href={`/news?status=${s}`}
            active={statusFilter === s}
            label={s.toUpperCase()}
            count={counts ? counts[s as keyof NewsStats] : undefined}
          />
        ))}
      </div>

      {news.length === 0 ? (
        <EmptyState message="No news found." />
      ) : (
        <>
          <div className="bg-white shadow overflow-hidden rounded-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Importance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lang</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telegram ID</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {news.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/news/${item.id}`} className="text-blue-600 hover:text-blue-800">
                          {item.title || item.rawText.slice(0, 80) || '—'}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sourceLabel(item.source)}</td>
                      <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={item.status} /></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.category || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatImportance(item.importance)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.sourceLanguage}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(item.createdAt)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.telegramMessageId || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {item.status === 'approved' && (
                          <form method="post" action={`/api/admin/publishing/publish/${item.id}`} className="inline">
                            <input type="hidden" name="next" value={`/news?status=approved`} />
                            <button type="submit" className="text-green-600 hover:text-green-800">
                              Publish
                            </button>
                          </form>
                        )}
                        {item.status !== 'approved' && <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Showing {news.length} item(s){statusFilter ? ` with status ${statusFilter.toUpperCase()}` : ''}.
          </p>
        </>
      )}
    </div>
  );
}