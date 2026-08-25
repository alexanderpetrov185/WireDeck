import { LoggerService } from '../logger/logger.service';

/**
 * Sprint 12: обработка HTTP 429 (rate limit) от AI/translation провайдеров
 * (например, free-tier Groq). Минимальный retry с exponential backoff.
 */

/**
 * Специальная ошибка: rate limit не снялся после всех ретраев.
 * Batch-методы сервисов используют её для раннего выхода из цикла,
 * считая остальные новости skipped (deferred), а не errors.
 */
export class RateLimitError extends Error {
  constructor(message = 'Rate limit reached (HTTP 429)') {
    super(message);
    this.name = 'RateLimitError';
  }
}

/** Максимальная задержка между ретраями (не зависаем дольше lockDuration job'а). */
export const MAX_RATE_LIMIT_DELAY_MS = 30000;

function extractHttpStatus(error: unknown): number | undefined {
  // Duck-typing axios error: error.response.status — без импорта axios в common-слой.
  const anyErr = error as { response?: { status?: number } } | null;
  return typeof anyErr?.response?.status === 'number' ? anyErr.response.status : undefined;
}

export function isRateLimitError(error: unknown): boolean {
  if (error instanceof RateLimitError) {
    return true;
  }
  const status = extractHttpStatus(error);
  if (status === 429) {
    return true;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return /rate.?limit/i.test(msg);
}

/**
 * Retry-After из ответа провайдера (в секундах по RFC), конвертируется в мс.
 */
function extractRetryAfterMs(error: unknown): number | undefined {
  const headers = (error as { response?: { headers?: Record<string, unknown> } } | null)?.response?.headers;
  const raw = headers?.['retry-after'] ?? headers?.['Retry-After'];
  const seconds = Number(raw);
  if (!isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RateLimitRetryOptions {
  /** Сколько повторных попыток после первой неудачи (0 = без ретраев). */
  maxRetries: number;
  /** Базовая задержка backoff (экспоненциально удваивается). */
  baseDelayMs: number;
  /** Для логирования попыток (опционально). */
  logger?: LoggerService;
  logContext?: string;
}

/**
 * Выполняет fn с ретраями при 429/rate limit.
 * - Не-rate-limit ошибки пробрасываются как есть (без ретраев).
 * - Исчерпание ретраев → RateLimitError.
 * - Delay: Retry-After (если есть) либо baseDelayMs * 2^attempt, cap 30s.
 */
export async function withRateLimitRetry<T>(fn: () => Promise<T>, options: RateLimitRetryOptions): Promise<T> {
  const { maxRetries, baseDelayMs, logger, logContext } = options;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof RateLimitError || !isRateLimitError(error)) {
        throw error;
      }
      if (attempt >= maxRetries) {
        throw new RateLimitError();
      }
      const retryAfterMs = extractRetryAfterMs(error);
      const delayMs = Math.min(retryAfterMs ?? baseDelayMs * 2 ** attempt, MAX_RATE_LIMIT_DELAY_MS);
      logger?.warn(
        `Rate limited (429), retry ${attempt + 1}/${maxRetries} in ${delayMs}ms`,
        logContext,
      );
      await sleep(delayMs);
    }
  }
}