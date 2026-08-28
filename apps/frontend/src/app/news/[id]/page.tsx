// News detail - Server Component (fix admin loading):
// данные рендерятся на сервере; approve/reject/publish - нативные HTML-формы.
import Link from 'next/link';
import { fetchFromBackend } from '@/lib/server/backend-client';
import StatusBadge from '@/components/StatusBadge';
import ErrorState from '@/components/ErrorState';
import TopNav from '@/components/TopNav';
import { NewsItem, NewsStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ACTIONABLE: NewsStatus[] = ['queued', 'processed', 'translated'];

export default async function NewsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;

  let news: NewsItem;
  try {
    news = await fetchFromBackend<NewsItem>(`/news/${encodeURIComponent(id)}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load news';
    return (
      <div>
        <TopNav active="news" />
        <Link href="/news" className="text-blue-600 hover:text-blue-800 text-sm mt-4 inline-block">
          &larr; Back to news list
        </Link>
        <div className="mt-4">
          <ErrorState message={msg} />
        </div>
      </div>
    );
  }

  const actionable = ACTIONABLE.includes(news.status);

  // Banner после publish-действия.
  let banner: { kind: 'ok' | 'err'; text: string } | null = null;
  if (query.published === '1') {
    banner = {
      kind: news.telegramMessageId ? 'ok' : 'err',
      text: news.telegramMessageId
        ? `Published to Telegram (message ID: ${news.telegramMessageId}).`
        : 'Publish accepted, but Telegram message ID is not saved yet.',
    };
  } else if (query.already_published === '1') {
    banner = { kind: 'ok', text: 'Already published earlier — skipped (no duplicate sent).' };
  } else if (query.publish_error === '1') {
    banner = { kind: 'err', text: 'Publish failed. News must be APPROVED and Telegram must be reachable.' };
  }

  return (
    <div>
      <TopNav active="news" />
      <Link href="/news" className="text-blue-600 hover:text-blue-800 text-sm mt-4 inline-block">
        &larr; Back to news list
      </Link>

      <div className="flex items-start justify-between mt-4 mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-900">{news.title || 'Untitled'}</h2>
        <StatusBadge status={news.status} />
      </div>

      {/* Sprint 19: compliance badges */}
      {news.complianceLabels && (
        <div className="mb-6 rounded-md bg-orange-50 border border-orange-200 p-4">
          <p className="text-sm font-medium text-orange-800 mb-2">Compliance labels:</p>
          <div className="flex flex-wrap gap-2">
            {news.complianceLabels.split(',').filter(Boolean).map((label) => (
              <span
                key={label}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"
              >
                {label}
                {label === 'terror_extremist' && ' (autopublish blocked)'}
              </span>
            ))}
          </div>
        </div>
      )}

      {banner && (
        <div
          role="status"
          className={`mb-6 rounded-md p-4 text-sm ${
            banner.kind === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {banner.text}
        </div>
      )}

      {actionable && (
        <div className="mb-6 bg-white shadow rounded-lg p-4 flex items-center gap-6">
          {/* Нативные формы модерации: работают без клиентского JS. */}
          <form method="post" action={`/api/admin/moderation/approve/${news.id}`}>
            <input type="hidden" name="next" value={`/news/${news.id}`} />
            <button type="submit" className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
              Approve
            </button>
          </form>
          <form method="post" action={`/api/admin/moderation/reject/${news.id}`} className="flex items-center gap-3">
            <input type="hidden" name="next" value={`/news/${news.id}`} />
            <input type="text" name="reason" required placeholder="Rejection reason" className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none w-64" />
            <button type="submit" className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700">
              Reject
            </button>
          </form>
        </div>
      )}

      {news.status === 'approved' && (
        <div className="mb-6 bg-white shadow rounded-lg p-4">
          {/* Нативная форма publish: работает без клиентского JS. */}
          <form method="post" action={`/api/admin/publishing/publish/${news.id}`}>
            <input type="hidden" name="next" value={`/news/${news.id}`} />
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
            >
              Publish now
            </button>
          </form>
        </div>
      )}

      {news.sourceUrl && (
        <p className="mb-4 text-sm">
          <a href={news.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800">
            Open original source &rarr;
          </a>
        </p>
      )}

      <div className="bg-white shadow overflow-hidden rounded-lg mb-6">
        <dl className="divide-y divide-gray-200">
          {([
            ['Source', `${news.sourceName || news.source}`],
            ['Category', news.category || '-'],
            ['Importance', String(news.importance ?? '-')],
            ['Language', news.sourceLanguage],
            ['Telegram message', news.telegramMessageId || '-'],
            ['Created', news.createdAt],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="px-6 py-3 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">{label}</dt>
              <dd className="text-sm text-gray-900 col-span-2">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {(news.title || news.summary || news.translatedText) && (
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Processed content</h3>
          <div className="bg-white shadow rounded-lg p-6 text-sm text-gray-800 whitespace-pre-wrap">
            {news.title && <p className="font-medium mb-2">{news.title}</p>}
            {news.summary && <p className="mb-2 text-gray-600">{news.summary}</p>}
            {news.translatedText && <p>{news.translatedText}</p>}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Raw text</h3>
        <div className="bg-white shadow rounded-lg p-6 text-sm text-gray-800 whitespace-pre-wrap">{news.rawText || '-'}</div>
      </section>
    </div>
  );
}
