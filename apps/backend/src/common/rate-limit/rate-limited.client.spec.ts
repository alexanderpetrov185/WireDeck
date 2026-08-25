import { RateLimitError, isRateLimitError, withRateLimitRetry } from './rate-limited.client';
import { LoggerService } from '../logger/logger.service';

const axiosLikeError = (status: number, retryAfter?: string): unknown => ({
  response: {
    status,
    headers: retryAfter ? { 'retry-after': retryAfter } : {},
  },
});

describe('rate-limited.client', () => {
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as unknown as LoggerService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isRateLimitError', () => {
    it('detects HTTP 429 status', () => {
      expect(isRateLimitError(axiosLikeError(429))).toBe(true);
    });

    it('detects rate limit message without status', () => {
      expect(isRateLimitError(new Error('Rate limit exceeded'))).toBe(true);
    });

    it('does not match other errors', () => {
      expect(isRateLimitError(axiosLikeError(500))).toBe(false);
      expect(isRateLimitError(new Error('timeout'))).toBe(false);
    });
  });

  describe('withRateLimitRetry', () => {
    it('returns result on first success without retries', async () => {
      const fn = jest.fn().mockResolvedValue('ok');
      await expect(withRateLimitRetry(fn, { maxRetries: 2, baseDelayMs: 1 })).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on 429 and succeeds on second attempt', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(axiosLikeError(429))
        .mockResolvedValueOnce('ok');
      await expect(withRateLimitRetry(fn, { maxRetries: 2, baseDelayMs: 1, logger })).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('throws RateLimitError after exhausting retries', async () => {
      const fn = jest.fn().mockRejectedValue(axiosLikeError(429));
      await expect(withRateLimitRetry(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow(RateLimitError);
      // 1 initial + 2 retries
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('respects Retry-After header over exponential backoff', async () => {
      const fn = jest.fn().mockRejectedValue(axiosLikeError(429, '0'));
      await expect(withRateLimitRetry(fn, { maxRetries: 1, baseDelayMs: 5000 })).rejects.toThrow(RateLimitError);
      // Retry-After: 0 -> delay 0 (capped), test completes fast; just verify attempts.
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('does not retry non-rate-limit errors', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('internal error'));
      await expect(withRateLimitRetry(fn, { maxRetries: 3, baseDelayMs: 1 })).rejects.toThrow('internal error');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});