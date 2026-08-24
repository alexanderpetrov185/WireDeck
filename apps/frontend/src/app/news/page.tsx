'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import { getNews } from '@/lib/news-api';
import { ApiClientError } from '@/lib/api-client';
import { NewsItem, NewsStatus } from '@/lib/types';
import { formatDate, formatImportance, sourceLabel } from '@/lib/news-labels';

const PAGE_SIZE = 50;

export default function NewsListPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<NewsStatus | ''>('');

  const load = useCallback(async (status: NewsStatus | '', skip: number) => {
    try {
      const items = await getNews({
        limit: PAGE_SIZE,
        skip,
        status: status || undefined,
      });
      return items;
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Failed to load news';
      setError(msg);
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

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const items = await load(statusFilter, news.length);
    if (items) setNews((prev) => [...prev, ...items]);
    setLoadingMore(false);
  };

  if (loading) {
    return <LoadingState label="Loading news..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">News</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as NewsStatus | '')}
          className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
        >
          <option value="">All statuses</option>
          <option value="raw">RAW</option>
          <option value="processed">PROCESSED</option>
          <option value="translated">TRANSLATED</option>
          <option value="queued">QUEUED</option>
          <option value="approved">APPROVED</option>
          <option value="published">PUBLISHED</option>
          <option value="rejected">REJECTED</option>
        </select>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}