'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import ConfirmModal from '@/components/ConfirmModal';
import { getNews } from '@/lib/news-api';
import { approveNews, rejectNews } from '@/lib/moderation-api';
import { ApiClientError } from '@/lib/api-client';
import { NewsItem, NewsStatus } from '@/lib/types';
import { formatDate, formatImportance, sourceLabel } from '@/lib/news-labels';

const PAGE_SIZE = 50;

/**
 * Страница модерации: список новостей, требующих решения.
 * По умолчанию показывает QUEUED; можно переключить фильтр статуса.
 */
export default function ModerationPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<NewsStatus>('queued');

  const [target, setTarget] = useState<{ id: string; mode: 'approve' | 'reject' } | null>(null);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);

  const load = useCallback(async (status: NewsStatus, skip: number): Promise<NewsItem[] | null> => {
    try {
      return await getNews({ limit: PAGE_SIZE, skip, status });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load news');
      return null;
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    load(statusFilter, 0).then((items) => {
      if (items) setNews(items);
      setLoading(false);
    });
  }, [statusFilter, load]);

  const handleModerate = async () => {
    if (!target) return;
    if (target.mode === 'reject' && !reason.trim()) return;
    setActing(true);
    setActionError(null);
    try {
      const result =
        target.mode === 'approve'
          ? await approveNews(target.id)
          : await rejectNews(target.id, reason.trim());
      setActionResult(
        `Moderation done: processed ${result.processed}, skipped ${result.skipped}, errors ${result.errors}.`,
      );
      setTarget(null);
      setReason('');
      const items = await load(statusFilter, 0);
      if (items) setNews(items);
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.message : 'Moderation action failed');
      setTarget(null);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading moderation queue..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Moderation</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as NewsStatus)}
          className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
        >
          <option value="queued">QUEUED</option>
          <option value="approved">APPROVED</option>
          <option value="rejected">REJECTED</option>
          <option value="raw">RAW</option>
          <option value="processed">PROCESSED</option>
          <option value="translated">TRANSLATED</option>
          <option value="published">PUBLISHED</option>
        </select>
      </div>

      {actionResult && (
        <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-800">{actionResult}</div>
      )}
      {actionError && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">{actionError}</div>
      )}

      {news.length === 0 ? (
        <EmptyState message="No news in this queue." />
      ) : (
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Importance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
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
                    <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={item.status} /></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sourceLabel(item.source)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatImportance(item.importance)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(item.createdAt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        type="button"
                        onClick={() => setTarget({ id: item.id, mode: 'approve' })}
                        disabled={acting}
                        className="text-green-600 hover:text-green-800 mr-3 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setTarget({ id: item.id, mode: 'reject' })}
                        disabled={acting}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ConfirmModal
        open={target?.mode === 'approve'}
        title="Approve news"
        message="Approve this news for publishing?"
        confirmLabel="Approve"
        onConfirm={handleModerate}
        onCancel={() => setTarget(null)}
      />

      {target?.mode === 'reject' && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true" role="dialog">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setTarget(null)} />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Reject news</h3>
                <p className="mt-2 text-sm text-gray-500">Provide a rejection reason (required).</p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="mt-3 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  placeholder="Rejection reason"
                />
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleModerate}
                  disabled={acting || !reason.trim()}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {acting ? 'Rejecting...' : 'Reject'}
                </button>
                <button
                  type="button"
                  onClick={() => setTarget(null)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
