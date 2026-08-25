// Moderation — Server Component (fix admin loading):
// очередь рендерится на сервере; approve/reject — нативные HTML-формы,
// работающие даже без клиентского JS.
import Link from 'next/link';
import { fetchFromBackend } from '@/lib/server/backend-client';
import StatusBadge from '@/components/StatusBadge';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import { NewsItem, NewsStatus } from '@/lib/types';
import { formatDate, formatImportance } from '@/lib/news-labels';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;
const STATUSES: NewsStatus[] = ['queued', 'approved', 'rejected', 'processed', 'translated'];

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const statusRaw = typeof params.status === 'string' ? params.status : '';
  const statusFilter = STATUSES.includes(statusRaw as NewsStatus) ? (statusRaw as NewsStatus) : 'queued';

  let news: NewsItem[];
  try {
    news = await fetchFromBackend<NewsItem[]>(
      `/news?${new URLSearchParams({ limit: String(PAGE_SIZE), skip: '0', status: statusFilter })}`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load moderation queue';
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Moderation</h2>
        <ErrorState message={msg} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Moderation</h2>
        {/* GET-форма фильтра: работает без JS. */}
        <form method="get" action="/moderation" className="flex items-center gap-2">
          <label htmlFor="status" className="text-sm text-gray-500">Status</label>
          <select
            id="status"
            name="status"
            defaultValue={statusFilter}
            className="rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.toUpperCase()}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Apply
          </button>
        </form>
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
                          <form
                            method="post"
                            action={`/api/admin/moderation/reject/${item.id}`}
                            className="flex items-center gap-2"
                          >
                            <input type="hidden" name="next" value={`/moderation?status=${statusFilter}`} />
                            <input
                              type="text"
                              name="reason"
                              required
                              placeholder="Reject reason"
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none w-40"
                            />
                            <button type="submit" className="text-red-600 hover:text-red-800">
                              Reject
                            </button>
                          </form>
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