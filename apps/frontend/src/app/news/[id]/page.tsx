'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import ConfirmModal from '@/components/ConfirmModal';
import { getNewsById } from '@/lib/news-api';
import { approveNews, rejectNews } from '@/lib/moderation-api';
import { ApiClientError } from '@/lib/api-client';
import { NewsItem } from '@/lib/types';
import { formatDate, formatImportance, sourceLabel, NEWS_STATUS_LABELS } from '@/lib/news-labels';

/**
 * Детальная страница новости (Sprint 10).
 * Показывает все поля News entity и панель модерации для actionable статусов.
 */
export default function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [news, setNews] = useState<NewsItem | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [moderating, setModerating] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async (newsId: string) => {
    setLoading(true);
    setError(null);
    try {
      setNews(await getNewsById(newsId));
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 404) {
        setNotFound(true);
      } else {
        setError(e instanceof ApiClientError ? e.message : 'Failed to load news');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) load(id);
  }, [id, load]);

  const handleApprove = async () => {
    if (!id) return;
    setModerating(true);
    setActionError(null);
    try {
      const result = await approveNews(id);
      setActionResult(`Approved: processed ${result.processed}.`);
      await load(id);
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.message : 'Approve failed');
    } finally {
      setModerating(false);
    }
  };

  const handleReject = async () => {
    if (!id || !reason.trim()) return;
    setModerating(true);
    setActionError(null);
    try {
      const result = await rejectNews(id, reason.trim());
      setActionResult(`Rejected: processed ${result.processed}. Reason: ${reason.trim()}`);
      setShowReject(false);
      setReason('');
      await load(id);
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.message : 'Reject failed');
    } finally {
      setModerating(false);
    }
  };

  if (!id || loading) {
    return <LoadingState label="Loading news..." />;
  }

  if (notFound) {
    return (
      <div>
        <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800 mb-4">News not found.</div>
        <Link href="/news" className="text-blue-600 hover:text-blue-800 text-sm">&larr; Back to news list</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <ErrorState message={error} />
        <Link href="/news" className="text-blue-600 hover:text-blue-800 text-sm mt-4 inline-block">&larr; Back to news list</Link>
      </div>
    );
  }

  if (!news) return null;

  const canModerate = ['queued', 'raw', 'processed', 'translated'].includes(news.status);

  const rows: Array<[string, React.ReactNode]> = [
    ['Status', <StatusBadge key="s" status={news.status} />],
    ['Source', sourceLabel(news.source)],
    ['Source ID', news.sourceId],
    ['Source Name', news.sourceName ?? '—'],
    ['Author', news.author ?? '—'],
    ['Trust Score', news.trustScore !== null ? String(news.trustScore) : '—'],
    ['Language', news.sourceLanguage],
    ['Category', news.category ?? '—'],
    ['Importance', formatImportance(news.importance)],
    ['Sentiment', news.sentiment ?? '—'],
    ['Telegram Message ID', news.telegramMessageId ?? '—'],
    ['Moderated By', news.moderatedBy ?? '—'],
    ['Moderated At', formatDate(news.moderatedAt)],
    ['Rejection Reason', news.rejectionReason ?? '—'],
    ['Published At', formatDate(news.publishedAt)],
    ['Created', formatDate(news.createdAt)],
    ['Updated', formatDate(news.updatedAt)],
  ];

  return (
    <div>
      <Link href="/news" className="text-blue-600 hover:text-blue-800 text-sm">&larr; Back to news list</Link>

      <div className="flex items-center justify-between mt-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900">{news.title || 'Untitled'}</h2>
        {canModerate && (
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleApprove}
              disabled={moderating}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none disabled:opacity-50"
            >
              {moderating ? 'Working...' : 'Approve'}
            </button>
            <button
              type="button"
              onClick={() => setShowReject(true)}
              disabled={moderating}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )}
      </div>

      {actionResult && <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-800">{actionResult}</div>}
      {actionError && <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">{actionError}</div>}

      {news.sourceUrl && (
        <p className="mb-4 text-sm">
          <a href={news.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800">
            Open original source &rarr;
          </a>
        </p>
      )}

      <div className="bg-white shadow overflow-hidden rounded-lg mb-6">
        <dl className="divide-y divide-gray-200">
          {rows.map(([label, value]) => (
            <div key={label} className="px-6 py-3 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">{label}</dt>
              <dd className="text-sm text-gray-900 col-span-2">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Raw text</h3>
        <div className="bg-white shadow rounded-lg p-6 text-sm text-gray-800 whitespace-pre-wrap">
          {news.rawText || '—'}
        </div>
      </section>

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

      <ConfirmModal
        open={showReject}
        title={`Reject (${NEWS_STATUS_LABELS[news.status]})`}
        message="Provide a rejection reason (required)."
        confirmLabel={moderating ? 'Rejecting...' : 'Reject'}
        onConfirm={handleReject}
        onCancel={() => setShowReject(false)}
      />

      {showReject && (
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Rejection reason"
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg rounded-md border-gray-300 shadow-lg focus:border-blue-500 focus:ring-blue-500 text-sm p-3"
        />
      )}
    </div>
  );
}
