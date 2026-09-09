import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { TwitterCollector } from './twitter.collector';
import { TwitterWatchlistService } from './twitter-watchlist.service';
import { LoggerService } from '../../../../common/logger/logger.service';

describe('TwitterCollector (Sprint 22c, cost-capped)', () => {
  const makeConfig = (values: Record<string, unknown>) =>
    ({
      get: (key: string, d?: unknown) => (key in values ? values[key] : d),
    }) as unknown as ConfigService;

  const makeWatchlist = (enabled: boolean) =>
    ({
      isEnabled: () => enabled,
      getEntries: () =>
        enabled
          ? [
              { handle: 'user1', tier: 1, unconfirmed: true },
              { handle: 'user2', tier: 2, unconfirmed: false },
            ]
          : [],
    }) as unknown as TwitterWatchlistService;

  const makeLogger = () => ({ log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) as unknown as LoggerService;

  const makeHttp = () => ({ get: jest.fn() });

  it('returns [] and makes NO http calls without API key (zero-cost default)', async () => {
    const http = makeHttp();
    const svc = new TwitterCollector(makeConfig({ TWITTER_API_KEY: '' }), http as never, makeWatchlist(true), makeLogger());

    const result = await svc.collect();

    expect(result).toEqual([]);
    expect(http.get).not.toHaveBeenCalled();
  });

  it('returns [] and makes NO http calls with disabled watchlist', async () => {
    const http = makeHttp();
    const svc = new TwitterCollector(makeConfig({ TWITTER_API_KEY: 'key' }), http as never, makeWatchlist(false), makeLogger());

    const result = await svc.collect();

    expect(result).toEqual([]);
    expect(http.get).not.toHaveBeenCalled();
  });

  it('polls vendor per handle and maps tweets with overrides', async () => {
    const http = makeHttp();
    http.get.mockImplementation((_url: string, opts: { params: { userName: string } }) => {
      if (opts.params.userName === 'user1') {
        return of({
          data: {
            tweets: [
              { id: '111', text: 'Big market news', createdAt: '2026-09-01T10:00:00Z' },
              { id: '', text: 'invalid — skipped' },
            ],
          },
        });
      }
      return of({ data: { tweets: [{ id: '222', text: 'Another post' }] } });
    });
    const svc = new TwitterCollector(
      makeConfig({ TWITTER_API_KEY: 'key', TWITTER_VENDOR_URL: 'https://vendor.test' }),
      http as never,
      makeWatchlist(true),
      makeLogger(),
    );

    const result = await svc.collect();

    expect(http.get).toHaveBeenCalledTimes(2);
    expect(http.get).toHaveBeenCalledWith('https://vendor.test/user/last_tweets', expect.objectContaining({ params: { userName: 'user1' } }));
    expect(result).toHaveLength(2);
    const first = result[0];
    expect(first.sourceId).toBe('111');
    expect(first.source).toBe('twitter');
    expect(first.sourceName).toBe('X: @user1');
    expect(first.author).toBe('@user1');
    expect(first.sourceUrl).toBe('https://x.com/user1/status/111');
    expect(first.tierOverride).toBe(1);
    expect(first.unconfirmedOverride).toBe(true);
    expect(first.rawText).toBe('Big market news');
    expect(result[1].tierOverride).toBe(2);
    expect(result[1].unconfirmedOverride).toBe(false);
  });

  it('isolates per-handle failures (one bad handle does not break others)', async () => {
    const http = makeHttp();
    http.get.mockImplementation((_url: string, opts: { params: { userName: string } }) =>
      opts.params.userName === 'user1' ? throwError(() => new Error('boom')) : of({ data: { tweets: [{ id: '222', text: 'ok' }] } }),
    );
    const svc = new TwitterCollector(makeConfig({ TWITTER_API_KEY: 'key' }), http as never, makeWatchlist(true), makeLogger());

    const result = await svc.collect();

    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe('222');
  });

  it('opens circuit breaker after repeated full-failure ticks and skips calls while open', async () => {
    const http = makeHttp();
    http.get.mockReturnValue(throwError(() => new Error('vendor down')));
    const svc = new TwitterCollector(makeConfig({ TWITTER_API_KEY: 'key' }), http as never, makeWatchlist(true), makeLogger());

    for (let i = 0; i < 5; i++) {
      await svc.collect();
    }
    expect(http.get).toHaveBeenCalledTimes(10); // 5 ticks × 2 handles

    // 6-й тик — breaker открыт, вызовов больше нет.
    const result = await svc.collect();
    expect(result).toEqual([]);
    expect(http.get).toHaveBeenCalledTimes(10);
  });

  it('respects TWITTER_POLL_LIMIT (max accounts per tick)', async () => {
    const watchlist = {
      isEnabled: () => true,
      getEntries: () =>
        Array.from({ length: 10 }, (_, i) => ({ handle: `user_${i}`, tier: 2, unconfirmed: false })),
    } as unknown as TwitterWatchlistService;
    const http = makeHttp();
    http.get.mockReturnValue(of({ data: { tweets: [] } }));
    const svc = new TwitterCollector(makeConfig({ TWITTER_API_KEY: 'key', TWITTER_POLL_LIMIT: 3 }), http as never, watchlist, makeLogger());

    await svc.collect();

    expect(http.get).toHaveBeenCalledTimes(3);
  });
});
