// API-функции для работы с новостями через BFF.
import { fetchJson } from './api-client';
import { NewsItem, NewsStats, NewsStatus } from './types';

export interface NewsListParams {
  limit?: number;
  skip?: number;
  status?: NewsStatus;
}

export async function getNews(params: NewsListParams = {}): Promise<NewsItem[]> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  if (params.skip !== undefined) search.set('skip', String(params.skip));
  if (params.status) search.set('status', params.status);

  const qs = search.toString();
  return fetchJson<NewsItem[]>(`/api/admin/news${qs ? `?${qs}` : ''}`);
}

export async function getNewsById(id: string): Promise<NewsItem> {
  return fetchJson<NewsItem>(`/api/admin/news/${encodeURIComponent(id)}`);
}

export async function getNewsStats(): Promise<NewsStats> {
  return fetchJson<NewsStats>('/api/admin/news/stats');
}