// Dashboard — Server Component (Sprint 13 fix):
// данные грузятся на сервере через BFF, страница не зависит от гидрации JS
// и не может зависнуть в вечном Loading.
import { fetchFromBackend } from '@/lib/server/backend-client';
import StatCard from '@/components/StatCard';
import ErrorState from '@/components/ErrorState';
import { NewsStats, HealthStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Баннеры publish-pending из query (?published=N&failed=M). */
function pendingBanner(params: Record<string, string | string[] | undefined>) {
  if (params.published === undefined) return null;
  const published = Number(params.published ?? 0);
  const failed = Number(params.failed ?? 0);
  if (failed > 0) {
    return { kind: 'err' as const, text: `Publish pending finished: published ${published}, failed ${failed}.` };
  }
  return { kind: 'ok' as const, text: `Publish pending finished: published ${published}.` };
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const banner = pendingBanner(params);
  let stats: NewsStats;
  let health: HealthStatus | null = null;

  try {
    [stats, health] = await Promise.all([
      fetchFromBackend<NewsStats>('/news/stats'),
      fetchFromBackend<HealthStatus>('/health').catch(() => null),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load dashboard data';
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
        <ErrorState message={msg} />
      </div>
    );
  }

  const backendStatus = health?.status === 'ok' ? 'Online' : 'Offline';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Backend:{' '}
            <span className={health?.status === 'ok' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
              {backendStatus}
            </span>
          </span>
          {/* Нативные формы: работают даже без клиентского JS. */}
          <form method="post" action="/api/admin/publishing/publish-pending">
            <input type="hidden" name="next" value="/" />
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
            >
              Publish pending
            </button>
          </form>
          <form method="post" action="/api/admin/pipeline/trigger">
            <input type="hidden" name="next" value="/" />
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
            >
              Run Pipeline
            </button>
          </form>
        </div>
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

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={stats.total} accent="bg-blue-500" />
        <StatCard label="RAW" value={stats.raw} accent="bg-gray-500" />
        <StatCard label="PROCESSED" value={stats.processed} accent="bg-blue-400" />
        <StatCard label="TRANSLATED" value={stats.translated} accent="bg-cyan-500" />
        <StatCard label="QUEUED" value={stats.queued} accent="bg-yellow-500" />
        <StatCard label="APPROVED" value={stats.approved} accent="bg-indigo-500" />
        <StatCard label="PUBLISHED" value={stats.published} accent="bg-green-500" />
        <StatCard label="REJECTED" value={stats.rejected} accent="bg-red-500" />
      </div>
    </div>
  );
}