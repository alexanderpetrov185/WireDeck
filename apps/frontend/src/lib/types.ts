// Типы API-ответов для Frontend Admin (Sprint 10)
// Отражают реальные поля News entity и существующие backend DTO.

export type NewsStatus =
  | 'raw'
  | 'processed'
  | 'translated'
  | 'queued'
  | 'approved'
  | 'published'
  | 'rejected';

export type NewsSource =
  | 'twitter'
  | 'newsapi'
  | 'google_news'
  | 'binance'
  | 'coingecko'
  | 'rss'
  | 'manual';

export type NewsLanguage = 'en' | 'ru' | 'uz';

export interface NewsItem {
  id: string;
  sourceId: string;
  sourceUrl: string | null;
  source: NewsSource;
  sourceName: string | null;
  author: string | null;
  trustScore: number | null;
  rawText: string;
  sourceLanguage: NewsLanguage;
  status: NewsStatus;
  title: string | null;
  summary: string | null;
  translatedText: string | null;
  importance: number | null;
  sentiment: string | null;
  category: string | null;
  // Sprint 22a: market impact
  impactScore: number | null;
  impactThesis: string | null;
  affectedAssets: string | null;
  affectedSectors: string | null;
  timeHorizon: string | null;
  unconfirmed: boolean | null;
  hash: string;
  duplicateOf: string | null;
  telegramMessageId: string | null;
  moderatedBy: string | null;
  moderatedAt: string | null;
  rejectionReason: string | null;
  publishedAt: string | null;
  // Sprint 19: compliance-маркировка (comma-separated категории, null = clean).
  complianceLabels: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewsStats {
  raw: number;
  processed: number;
  translated: number;
  queued: number;
  approved: number;
  published: number;
  rejected: number;
  total: number;
}

export interface HealthStatus {
  status: string;
  info?: Record<string, unknown>;
  error?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

export interface PipelineTriggerResult {
  enqueued: boolean;
}

export interface ModerationResult {
  processed: number;
  skipped: number;
  errors: number;
}

export interface ApiError {
  error: string;
  message?: string;
  status?: number;
}