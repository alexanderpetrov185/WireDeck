// Хелперы для отображения статусов, источников и важности новостей.

import { NewsStatus, NewsSource } from './types';

export const NEWS_STATUS_LABELS: Record<NewsStatus, string> = {
  raw: 'RAW',
  processed: 'PROCESSED',
  translated: 'TRANSLATED',
  queued: 'QUEUED',
  approved: 'APPROVED',
  published: 'PUBLISHED',
  rejected: 'REJECTED',
};

export const NEWS_STATUS_COLORS: Record<NewsStatus, string> = {
  raw: 'bg-gray-100 text-gray-800',
  processed: 'bg-blue-100 text-blue-800',
  translated: 'bg-cyan-100 text-cyan-800',
  queued: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-indigo-100 text-indigo-800',
  published: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export const NEWS_SOURCE_LABELS: Record<NewsSource, string> = {
  twitter: 'Twitter/X',
  newsapi: 'NewsAPI',
  google_news: 'Google News',
  binance: 'Binance',
  coingecko: 'CoinGecko',
  rss: 'RSS',
  manual: 'Manual',
};

export function formatImportance(importance: number | null): string {
  if (importance === null || importance === undefined) {
    return '—';
  }
  return importance.toFixed(2);
}

export function formatDate(date: string | null): string {
  if (!date) {
    return '—';
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return '—';
  }
  return d.toLocaleString();
}

export function sourceLabel(source: NewsSource): string {
  return NEWS_SOURCE_LABELS[source] ?? source;
}