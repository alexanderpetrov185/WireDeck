// Moderation — Server Component (fix admin loading):
// очередь рендерится на сервере; approve/reject — нативные HTML-формы,
// работающие даже без клиентского JS.
import Link from 'next/link';
import { fetchFromBackend } from '@/lib/server/backend-client';
import StatusBadge from '@/components/StatusBadge';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import TopNav from '@/components/TopNav';
import { NewsItem, NewsStatus, NewsStats } from '@/lib/types';
import { formatDate, formatImportance } from '@/lib/news-labels';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;
const STATUSES: NewsStatus[] = ['queued', 'approved', 'rejected', 'processed', 'translated'];

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

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const statusRaw = typeof params.status === 'string' ? params.status : '';
  const statusFilter = STATUSES.includes(statusRaw as NewsStatus) ? (statusRaw as NewsStatus) : 'queued';

  let news: NewsItem[];
  // Counts для чипов: fail-safe.
  let counts: NewsStats | null = null;
  try {
    news = await fetchFromBackend<NewsItem[]>(
      `/news?${new URLSearchParams({ limit: String(PAGE_SIZE), skip: '0', status: statusFilter })}`,
    );
    counts = await fetchFromBackend<NewsStats>('/news/stats').catch(() => null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load moderation queue';
    return (
      <div>
        <TopNav active="moderation" />
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Moderation</h2>
        <ErrorState message={msg} />
      </div>
    );
  }

  return (
    <div>
      <TopNav active="moderation" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Moderation</h2>
      </div>

      {/* Status chips с counts (fail-safe). */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {STATUSES.map((s) => (
          <Chip
            key={s}
            href={`/moderation?status=${s}`}
            active={statusFilter === s}
            label={s.toUpperCase()}
            count={counts ? counts[s as keyof NewsStats] : undefined}
          />
        ))}
      </div>

      {news.length === 0 ? (
        <EmptyState message={`Nothing in the ${statusFilter.toUpperCase()} queue.`} />
      ) : (
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {news.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link href={`/news/${item.id}`} className="text-blue-600 hover:text-blue-800">
                        {item.title || item.rawText.slice(0, 80) || '—'}
                      </Link>
                      {item.summary && <p className="mt-1 text-sm text-gray-500">{item.summary}</p>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={item.status} /></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(item.createdAt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {(statusFilter === 'queued' || statusFilter === 'processed' || statusFilter === 'translated') && (
                        <div className="flex items-center justify-end gap-3">
                          {/* Нативные формы: работают без клиентского JS. */}
                          <form method="post" action={`/api/admin/moderation/approve/${item.id}`}>
                            <input type="hidden" name="next" value={`/moderation?status=${statusFilter}`} />
                            <button type="submit" className="text-green-600 hover:text-green-800">
                              Approve
                            </button>
                          </form>
                          {/* Reject свёрнут в details: нативно, без JS, не загромождает таблицу. */}
                          <details className="relative">
                            <summary className="list-none cursor-pointer text-red-600 hover:text-red-800 select-none">
                              Reject
                            </summary>
                            <form
                              method="post"
                              action={`/api/admin/moderation/reject/${item.id}`}
                              className="absolute right-0 z-10 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg p-3 space-y-2"
                            >
                              <input type="hidden" name="next" value={`/moderation?status=${statusFilter}`} />
                              <input
                                type="text"
                                name="reason"
                                required
                                placeholder="Reject reason"
                                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                              />
                              <button
                                type="submit"
                                className="w-full rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                              >
                                Confirm reject
                              </button>
                            </form>
                          </details>
                        </div>
                      )}
                      {formatImportance(item.importance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-gray-400">Showing {news.length} item(s) in {statusFilter.toUpperCase()}.</p>
    </div>
  );
}