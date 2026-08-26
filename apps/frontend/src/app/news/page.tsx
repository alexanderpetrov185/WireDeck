// News list — Server Component (fix admin loading):
// данные рендерятся на сервере; фильтр статуса — обычная GET-форма без JS.
import Link from 'next/link';
import { fetchFromBackend } from '@/lib/server/backend-client';
import StatusBadge from '@/components/StatusBadge';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import { NewsItem, NewsStatus } from '@/lib/types';
import { formatDate, formatImportance, sourceLabel } from '@/lib/news-labels';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;
const STATUSES: NewsStatus[] = ['raw', 'processed', 'translated', 'queued', 'approved', 'published', 'rejected'];

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
  try {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), skip: '0' });
    if (statusFilter) qs.set('status', statusFilter);
    news = await fetchFromBackend<NewsItem[]>(`/news?${qs.toString()}`);
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">News</h2>
        {/* GET-форма фильтра: работает без JS. */}
        <form method="get" action="/news" className="flex items-center gap-2">
          <label htmlFor="status" className="text-sm text-gray-500">Status</label>
          <select
            id="status"
            name="status"
            defaultValue={statusFilter}
            className="rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          >
            <option value="">All statuses</option>
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